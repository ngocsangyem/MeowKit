/**
 * tool_use block handler — registers pending call, emits tool_call_start
 * (and subagent_dispatch + agent_spawn for Task/Agent tools).
 *
 * Ported from patoles/agent-flow @ 59ccf4e (transcript-parser.ts:265-306).
 * License Apache-2.0 (see ../../../NOTICE).
 */

import type { TranscriptParser } from "./index.js";
import type { PendingToolCall, ToolUseBlock } from "../protocol.js";
import { emitSubagentSpawn } from "../protocol.js";
import { PREVIEW_MAX, resolveSubagentChildName } from "../constants.js";
import { extractInputData, summarizeInput } from "../tool-summarizer.js";

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

	parser.delegate.emit(
		{
			time: parser.delegate.elapsed(sessionId),
			type: "tool_call_start",
			payload: {
				agent: agentName,
				tool: toolName,
				args,
				preview: `${toolName}: ${args}`.slice(0, PREVIEW_MAX),
				inputData: extractInputData(toolName, block.input),
			},
		},
		sessionId,
	);
}
