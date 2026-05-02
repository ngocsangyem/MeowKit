/**
 * tool_result block handler — matches pending, emits tool_call_end + subagent_return.
 *
 * Ported from patoles/agent-flow @ 59ccf4e (transcript-parser.ts:308-378).
 * License Apache-2.0 (see ../../../NOTICE).
 */

import type { TranscriptParser } from "./index.js";
import type { PendingToolCall, ToolResultBlock } from "../protocol.js";
import { ARGS_MAX, CHILD_NAME_MAX, RESULT_MAX, FAILED_RESULT_MAX } from "../constants.js";
import { summarizeResult, buildDiscovery, detectError } from "../tool-summarizer.js";
import { estimateTokensFromContent } from "../token-estimator.js";
import { createLogger } from "../logger.js";
import { _getPauseRecord, _getPendingRejections } from "./handle-system.js";

const log = createLogger("handle-tool-result");

export function handleToolResult(
	parser: TranscriptParser,
	block: ToolResultBlock,
	agentName: string,
	ctxPending: Map<string, PendingToolCall>,
	sessionId?: string,
): void {
	const pending = ctxPending.get(block.tool_use_id);
	if (!pending) return;
	const toolName = pending.name;
	const result = summarizeResult(block.content);
	const tokenCost = estimateTokensFromContent(block.content);

	const session = sessionId ? parser.delegate.getSession(sessionId) : undefined;
	if (session) {
		if (toolName === "Task" || toolName === "Agent") {
			session.contextBreakdown.subagentResults += tokenCost;
		} else {
			session.contextBreakdown.toolResults += tokenCost;
		}
	}

	// ── Rejection detection [red-team #1] ─────────────────────────────────────
	// MUST use block.content string scan — block.is_error and entry.toolUseResult
	// do NOT exist on ToolResultBlock (protocol.ts:63-67 defines only type, tool_use_id, content).
	const resultText = _extractResultText(block.content);
	const isUserRejection =
		resultText.includes("User rejected tool use") ||
		resultText.startsWith("The user doesn't want to proceed with this tool use");

	// Log a warning if detectError flagged it but we didn't match a known rejection string,
	// in case Claude Code changes the wording (stability note from phase-02 spec).
	if (!isUserRejection && detectError(result)) {
		log.debug("tool_result has error but no known rejection string", {
			toolName,
			resultPreview: result.slice(0, 80),
		});
	}

	if (isUserRejection) {
		const key = `${sessionId ?? ""}:${agentName}`;
		_getPendingRejections(parser).add(key);
		// Record pause start so handle-text.ts can compute durationMs on clear.
		_getPauseRecord(parser).set(key, {
			reason: "tool_rejected",
			toolUseId: block.tool_use_id,
			startedAt: Date.now(),
		});
		parser.delegate.emit(
			{
				time: parser.delegate.elapsed(sessionId),
				type: "pause_started",
				payload: {
					agent: agentName,
					reason: "tool_rejected",
					toolUseId: block.tool_use_id,
					toolName,
				},
			},
			sessionId,
		);
	}

	// ── pause_cleared for AskUserQuestion / ExitPlanMode ─────────────────────
	// When matching tool_result arrives, clear the typed pause and emit durationMs.
	const pauseRecord = _getPauseRecord(parser);
	const pauseKey = `${sessionId ?? ""}:${agentName}`;
	const activeTypedPause = pauseRecord.get(pauseKey);
	if (
		activeTypedPause &&
		activeTypedPause.toolUseId === block.tool_use_id &&
		(activeTypedPause.reason === "ask_user_question" ||
			activeTypedPause.reason === "plan_mode_review")
	) {
		const durationMs = Date.now() - activeTypedPause.startedAt;
		pauseRecord.delete(pauseKey);
		parser.delegate.emit(
			{
				time: parser.delegate.elapsed(sessionId),
				type: "pause_cleared",
				payload: {
					agent: agentName,
					reason: activeTypedPause.reason,
					toolUseId: block.tool_use_id,
					durationMs,
				},
			},
			sessionId,
		);
	}

	ctxPending.delete(block.tool_use_id);

	const discovery = buildDiscovery(toolName, pending.filePath || "", result);

	if (toolName === "Task" || toolName === "Agent") {
		const childName =
			parser.subagentChildNames.get(block.tool_use_id) ||
			pending.args?.slice(0, CHILD_NAME_MAX) ||
			"subagent";
		parser.subagentChildNames.delete(block.tool_use_id);
		parser.inlineSubagentState.delete(block.tool_use_id);
		parser.delegate.emit(
			{
				time: parser.delegate.elapsed(sessionId),
				type: "subagent_return",
				payload: { child: childName, parent: agentName, summary: result.slice(0, ARGS_MAX) },
			},
			sessionId,
		);
		parser.delegate.emit(
			{
				time: parser.delegate.elapsed(sessionId),
				type: "agent_complete",
				payload: { name: childName },
			},
			sessionId,
		);
	}

	const isError = detectError(result);
	const errorMessage = isError ? result.slice(0, FAILED_RESULT_MAX) : undefined;

	parser.delegate.emit(
		{
			time: parser.delegate.elapsed(sessionId),
			type: "tool_call_end",
			payload: {
				agent: agentName,
				tool: toolName,
				result: result.slice(0, RESULT_MAX),
				tokenCost,
				...(discovery ? { discovery } : {}),
				...(isError ? { isError, errorMessage } : {}),
			},
		},
		sessionId,
	);

	if (session) parser.delegate.emitContextUpdate(agentName, session, sessionId);
}

/**
 * Extract a plain string from ToolResultBlock.content for rejection detection.
 * [red-team #1] NEVER use block.is_error or entry.toolUseResult — those fields don't exist.
 */
function _extractResultText(
	content: ToolResultBlock["content"],
): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map((c) => (c as { text?: string }).text ?? "")
			.join("");
	}
	return "";
}
