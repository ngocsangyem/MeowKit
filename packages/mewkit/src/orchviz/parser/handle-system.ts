/**
 * system JSONL entry handler — consumes stop_hook_summary with preventedContinuation=true
 * and emits pause_started{hook_blocked}.
 *
 * STABILITY NOTE: system.subtype "stop_hook_summary", preventedContinuation, hookInfos[],
 * and stopReason are observed in real transcripts but are NOT in any official Claude Code
 * docs. All field accesses are null-guarded; unknown shapes silently no-op.
 *
 * Phase-02 — new file.
 */

import type { TranscriptParser } from "./index.js";
import { HOOK_BLOCKED_MAX_MS } from "../constants.js";

/**
 * Minimal shape of a system JSONL line. Fields beyond `type` are undocumented
 * — treat all as optional/unknown.
 */
interface SystemEntry {
	type: "system";
	subtype?: string;
	preventedContinuation?: boolean;
	stopReason?: string;
	hookInfos?: Array<{ command?: string }>;
}

export function handleSystemEntry(
	parser: TranscriptParser,
	parsed: Record<string, unknown>,
	sessionId?: string,
	agentName?: string,
): void {
	const entry = parsed as unknown as SystemEntry;

	if (entry.subtype !== "stop_hook_summary") return;
	if (entry.preventedContinuation !== true) return;

	// Use the provided agentName (passed from processTranscriptLine) so that the
	// pending hook block key matches the compound key used in handle-text.ts clear path.
	// Fallback to ORCHESTRATOR_NAME only if caller omits agentName (defensive).
	const mainAgentName = agentName ?? "orchestrator";

	// Emit pause_started{hook_blocked}
	parser.delegate.emit(
		{
			time: parser.delegate.elapsed(sessionId),
			type: "pause_started",
			payload: {
				agent: mainAgentName,
				reason: "hook_blocked",
				detail: {
					// Defensive access: hookInfos and stopReason are undocumented fields
					hookCommand: entry.hookInfos?.[0]?.command,
					hookReason: entry.stopReason ?? "",
				},
			},
		},
		sessionId,
	);

	// Track pending hook block per compound key (red-team #12)
	const key = `${sessionId ?? ""}:${mainAgentName}`;
	_getPendingHookBlocks(parser).add(key);

	// Record pause start time for durationMs on clear (red-team #12 pauseRecord)
	const pauseRecord = _getPauseRecord(parser);
	const startedAt = Date.now();
	pauseRecord.set(key, {
		reason: "hook_blocked",
		toolUseId: undefined,
		startedAt,
	});

	// [validation Q6] Fail-open safety cap: auto-clear after 5min if no
	// matching assistant text from the same agent has cleared it. Prevents
	// permanent stuck UI when the hook resolves without a follow-up signal.
	// A server-side warning could be added; for now we trust the cap.
	const timer = setTimeout(() => {
		const blocks = _getPendingHookBlocks(parser);
		if (!blocks.has(key)) return; // already cleared via assistant text path
		blocks.delete(key);
		const rec = pauseRecord.get(key);
		pauseRecord.delete(key);
		parser.delegate.emit(
			{
				time: parser.delegate.elapsed(sessionId),
				type: "pause_cleared",
				payload: {
					agent: mainAgentName,
					reason: "hook_blocked",
					toolUseId: undefined,
					durationMs: rec ? Date.now() - rec.startedAt : HOOK_BLOCKED_MAX_MS,
				},
			},
			sessionId,
		);
	}, HOOK_BLOCKED_MAX_MS);
	if (typeof timer.unref === "function") timer.unref();
}

// ─── Parser context extension helpers ────────────────────────────────────────
// The TranscriptParser does not natively carry pause state — we attach it lazily
// via a WeakMap keyed on the parser instance so no protocol.ts changes are needed
// for the parser class itself. Phase-03 reads these same WeakMap accessors.

type PauseRecordEntry = { reason: string; toolUseId?: string; startedAt: number };

const pendingHookBlocksMap = new WeakMap<TranscriptParser, Set<string>>();
const pendingRejectionsMap = new WeakMap<TranscriptParser, Set<string>>();
const pauseRecordMap = new WeakMap<TranscriptParser, Map<string, PauseRecordEntry>>();

export function _getPendingHookBlocks(parser: TranscriptParser): Set<string> {
	let s = pendingHookBlocksMap.get(parser);
	if (!s) {
		s = new Set();
		pendingHookBlocksMap.set(parser, s);
	}
	return s;
}

export function _getPendingRejections(parser: TranscriptParser): Set<string> {
	let s = pendingRejectionsMap.get(parser);
	if (!s) {
		s = new Set();
		pendingRejectionsMap.set(parser, s);
	}
	return s;
}

export function _getPauseRecord(parser: TranscriptParser): Map<string, PauseRecordEntry> {
	let m = pauseRecordMap.get(parser);
	if (!m) {
		m = new Map();
		pauseRecordMap.set(parser, m);
	}
	return m;
}

