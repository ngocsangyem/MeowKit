/**
 * thinking block handler (incl. redacted form for Opus 4.7+).
 *
 * Ported from patoles/agent-flow @ 59ccf4e (transcript-parser.ts:236-263).
 * License Apache-2.0 (see ../../../NOTICE).
 */

import type { TranscriptParser } from "./index.js";
import type { WatchedSession } from "../protocol.js";
import { MESSAGE_MAX } from "../constants.js";
import { estimateTokensFromText } from "../token-estimator.js";
import {
	REDACTED_THINKING_LABEL,
	evictOldEntries,
	redactedThinkingSignature,
	safeThinking,
	thinkingHashKey,
} from "./utils.js";

export function handleThinkingBlock(
	parser: TranscriptParser,
	block: unknown,
	entryUuid: string | undefined,
	agentName: string,
	seenMsgs: Set<string> | undefined,
	session: WatchedSession | undefined,
	sessionId: string | undefined,
): void {
	const thinking = safeThinking(block);
	const redactedSig = thinking ? null : redactedThinkingSignature(block);
	if (!thinking && !redactedSig) return;

	const hash = thinkingHashKey(entryUuid, thinking || redactedSig || "");
	if (seenMsgs?.has(hash)) return;
	if (seenMsgs) {
		seenMsgs.add(hash);
		evictOldEntries(seenMsgs);
	}

	if (session && thinking) session.contextBreakdown.reasoning += estimateTokensFromText(thinking);

	parser.delegate.emit(
		{
			time: parser.delegate.elapsed(sessionId),
			type: "message",
			payload: {
				agent: agentName,
				role: "thinking",
				content: thinking ? thinking.slice(0, MESSAGE_MAX) : REDACTED_THINKING_LABEL,
				...(thinking ? {} : { redacted: true }),
			},
		},
		sessionId,
	);
}
