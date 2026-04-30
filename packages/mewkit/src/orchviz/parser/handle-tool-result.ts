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
