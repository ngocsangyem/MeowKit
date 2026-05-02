/**
 * text block handler — emits message events with dedup + system-prefix filter.
 *
 * Ported from patoles/agent-flow @ 59ccf4e (transcript-parser.ts:204-232).
 * License Apache-2.0 (see ../../../NOTICE).
 */

import type { TranscriptParser } from "./index.js";
import type { WatchedSession } from "../protocol.js";
import { HASH_PREFIX_MAX, MESSAGE_MAX } from "../constants.js";
import { estimateTokensFromText } from "../token-estimator.js";
import { evictOldEntries, isSystemInjectedContent, safeText } from "./utils.js";
import { _getPendingHookBlocks, _getPendingRejections, _getPauseRecord } from "./handle-system.js";

export function handleTextBlock(
	parser: TranscriptParser,
	block: unknown,
	emitRole: "user" | "assistant",
	entryUuid: string | undefined,
	agentName: string,
	seenMsgs: Set<string> | undefined,
	session: WatchedSession | undefined,
	sessionId: string | undefined,
): void {
	const text = safeText(block);
	if (!text) return;
	if (emitRole === "user" && isSystemInjectedContent(text)) return;

	// [red-team #9] Clear tool_rejected and hook_blocked ONLY when the SAME agent that
	// received pause_started emits next assistant text. A concurrent subagent's text
	// MUST NOT clear the parent's pending flags.
	// [red-team #12] Compound key: "${sessionId}:${agentName}" prevents cross-session collision.
	if (emitRole === "assistant") {
		const key = `${sessionId ?? ""}:${agentName}`;
		const pendingRejections = _getPendingRejections(parser);
		const pendingHookBlocks = _getPendingHookBlocks(parser);
		const pauseRecord = _getPauseRecord(parser);

		if (pendingRejections.has(key)) {
			pendingRejections.delete(key);
			const rec = pauseRecord.get(key);
			if (rec?.reason === "tool_rejected") {
				const durationMs = Date.now() - rec.startedAt;
				pauseRecord.delete(key);
				parser.delegate.emit(
					{
						time: parser.delegate.elapsed(sessionId),
						type: "pause_cleared",
						payload: {
							agent: agentName,
							reason: "tool_rejected",
							toolUseId: rec.toolUseId,
							durationMs,
						},
					},
					sessionId,
				);
			}
		}

		if (pendingHookBlocks.has(key)) {
			pendingHookBlocks.delete(key);
			const rec = pauseRecord.get(key);
			if (rec?.reason === "hook_blocked") {
				const durationMs = Date.now() - rec.startedAt;
				pauseRecord.delete(key);
				parser.delegate.emit(
					{
						time: parser.delegate.elapsed(sessionId),
						type: "pause_cleared",
						payload: {
							agent: agentName,
							reason: "hook_blocked",
							toolUseId: rec.toolUseId,
							durationMs,
						},
					},
					sessionId,
				);
			}
		}
	}

	const hash = entryUuid
		? `${emitRole}:${entryUuid}`
		: `${emitRole}:${text.slice(0, HASH_PREFIX_MAX)}`;
	if (seenMsgs?.has(hash)) return;
	if (seenMsgs) {
		seenMsgs.add(hash);
		evictOldEntries(seenMsgs);
	}

	if (session) {
		const tokens = estimateTokensFromText(text);
		if (emitRole === "user") session.contextBreakdown.userMessages += tokens;
		else session.contextBreakdown.reasoning += tokens;
	}
	parser.delegate.emit(
		{
			time: parser.delegate.elapsed(sessionId),
			type: "message",
			payload: { agent: agentName, role: emitRole, content: text.slice(0, MESSAGE_MAX) },
		},
		sessionId,
	);
}
