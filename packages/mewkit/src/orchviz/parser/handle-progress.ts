/**
 * progress event handler — inline subagent transcript entries (newer Claude Code).
 *
 * Ported from patoles/agent-flow @ 59ccf4e (transcript-parser.ts:380-421).
 * License Apache-2.0 (see ../../../NOTICE).
 */

import type { TranscriptParser } from "./index.js";
import type { TranscriptEntry } from "../protocol.js";
import { generateSubagentFallbackName } from "../constants.js";
import { isRecord } from "./utils.js";

export function handleProgressEvent(
	parser: TranscriptParser,
	parsed: Record<string, unknown>,
	sessionId: string | undefined,
): void {
	const data = parsed.data;
	if (!isRecord(data) || data.type !== "agent_progress") return;

	const innerEntry = data.message as TranscriptEntry | undefined;
	if (!innerEntry?.message) return;

	const parentToolUseID =
		typeof parsed.parentToolUseID === "string" ? parsed.parentToolUseID : undefined;
	if (!parentToolUseID) return;

	let subState = parser.inlineSubagentState.get(parentToolUseID);
	if (!subState) {
		const childName =
			parser.subagentChildNames.get(parentToolUseID) ||
			generateSubagentFallbackName("", parser.inlineSubagentState.size + 1);
		subState = {
			agentName: childName,
			pending: new Map(),
			seen: new Set(),
			seenMessages: new Set(),
		};
		parser.inlineSubagentState.set(parentToolUseID, subState);

		if (sessionId) {
			const session = parser.delegate.getSession(sessionId);
			session?.inlineProgressAgents.add(childName);
		}
	}

	const innerLine = JSON.stringify(innerEntry);
	parser.processTranscriptLine(
		innerLine,
		subState.agentName,
		subState.pending,
		subState.seen,
		sessionId,
		subState.seenMessages,
	);
}
