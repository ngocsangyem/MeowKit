/**
 * tool_use block handler — registers pending call, emits tool_call_start
 * (and subagent_dispatch + agent_spawn for Task/Agent tools).
 *
 * Ported from patoles/agent-flow @ 59ccf4e (transcript-parser.ts:265-306).
 * License Apache-2.0 (see ../../../NOTICE).
 */

import type { TranscriptParser } from "./index.js";
import type { PauseDetail, PendingToolCall, ToolUseBlock } from "../protocol.js";
import { emitSubagentSpawn } from "../protocol.js";
import { PLAN_PREVIEW_MAX, PREVIEW_MAX, resolveSubagentChildName } from "../constants.js";
import { extractInputData, summarizeInput } from "../tool-summarizer.js";
import { createLogger } from "../logger.js";
import { _getPauseRecord } from "./handle-system.js";

const log = createLogger("handle-tool-use");

export function handleToolUse(
	parser: TranscriptParser,
	block: ToolUseBlock,
	agentName: string,
	ctxPending: Map<string, PendingToolCall>,
	sessionId?: string,
): void {
	const toolName = block.name;
	const args = summarizeInput(toolName, block.input);

	const rawPath = block.input.file_path || block.input.path;
	const filePath = typeof rawPath === "string" ? rawPath : undefined;
	ctxPending.set(block.id, { name: toolName, args, filePath, startTime: Date.now() });

	if (toolName === "Task" || toolName === "Agent") {
		const childName = resolveSubagentChildName(block.input);
		parser.subagentChildNames.set(block.id, childName);
		const session = sessionId ? parser.delegate.getSession(sessionId) : undefined;
		if (!session?.spawnedSubagents.has(childName)) {
			session?.spawnedSubagents.add(childName);
			emitSubagentSpawn(parser.delegate, agentName, childName, args, sessionId);
		}
	}

	const inputData = extractInputData(toolName, block.input);

	parser.delegate.emit(
		{
			time: parser.delegate.elapsed(sessionId),
			type: "tool_call_start",
			payload: {
				agent: agentName,
				tool: toolName,
				args,
				preview: `${toolName}: ${args}`.slice(0, PREVIEW_MAX),
				inputData,
			},
		},
		sessionId,
	);

	// Emit pause_started AFTER tool_call_start (sequencing — spec risk note).
	if (toolName === "AskUserQuestion") {
		const detail = _buildAskUserQuestionDetail(inputData);
		const key = `${sessionId ?? ""}:${agentName}`;
		_getPauseRecord(parser).set(key, {
			reason: "ask_user_question",
			toolUseId: block.id,
			startedAt: Date.now(),
		});
		parser.delegate.emit(
			{
				time: parser.delegate.elapsed(sessionId),
				type: "pause_started",
				payload: {
					agent: agentName,
					reason: "ask_user_question",
					toolUseId: block.id,
					toolName,
					detail,
				},
			},
			sessionId,
		);
	} else if (toolName === "ExitPlanMode") {
		// input.plan is observed in real transcripts but undocumented — optional chaining.
		const rawPlan = (block.input.plan as string | undefined) ?? undefined;
		const detail: PauseDetail | undefined = rawPlan
			? { plan: rawPlan.slice(0, PLAN_PREVIEW_MAX) }
			: undefined;
		const key = `${sessionId ?? ""}:${agentName}`;
		_getPauseRecord(parser).set(key, {
			reason: "plan_mode_review",
			toolUseId: block.id,
			startedAt: Date.now(),
		});
		parser.delegate.emit(
			{
				time: parser.delegate.elapsed(sessionId),
				type: "pause_started",
				payload: {
					agent: agentName,
					reason: "plan_mode_review",
					toolUseId: block.id,
					toolName,
					...(detail ? { detail } : {}),
				},
			},
			sessionId,
		);
	}
}

/**
 * Build PauseDetail.questions from the already-extracted inputData for AskUserQuestion.
 * Validates per docs: 1-4 questions, 2-4 options each (best-effort; logs warning if violated).
 */
function _buildAskUserQuestionDetail(
	inputData: Record<string, unknown> | undefined,
): PauseDetail | undefined {
	if (!inputData) return undefined;
	const rawQs = inputData.questions as
		| Array<{ question?: string; header?: string; options?: string[]; multiSelect?: boolean }>
		| undefined;
	if (!Array.isArray(rawQs) || rawQs.length === 0) return undefined;

	// Warn if outside documented limits (1-4 questions, 2-4 options each)
	if (rawQs.length > 4 || rawQs.length < 1) {
		log.warn("AskUserQuestion: question count outside 1-4 docs limit", { count: rawQs.length });
	}

	const questions = rawQs.map((q) => {
		const opts = Array.isArray(q.options) ? q.options : [];
		if (opts.length > 4 || opts.length < 2) {
			log.warn("AskUserQuestion: option count outside 2-4 docs limit", { count: opts.length });
		}
		return {
			question: String(q.question ?? ""),
			...(q.header !== undefined ? { header: String(q.header) } : {}),
			options: opts.map(String),
			...(q.multiSelect !== undefined ? { multiSelect: Boolean(q.multiSelect) } : {}),
		};
	});

	return { questions };
}
