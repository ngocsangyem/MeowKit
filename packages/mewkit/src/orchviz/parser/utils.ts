/**
 * Pure helpers for transcript parsing.
 *
 * Ported from patoles/agent-flow @ 59ccf4e (transcript-parser.ts).
 * License Apache-2.0 (see ../../../NOTICE).
 */

import { HASH_PREFIX_MAX, SYSTEM_CONTENT_PREFIXES } from "../constants.js";
import { stripAnsi } from "./strip-ansi.js";

export const REDACTED_THINKING_LABEL = "Thinking...";

/** Cap on dedup Sets per session to bound memory in long sessions. */
export const MAX_DEDUP_ENTRIES = 10_000;

export function isRecord(v: unknown): v is Record<string, unknown> {
	return v !== null && typeof v === "object";
}

/** Strip ANSI then trim. */
export function safeText(block: unknown): string {
	if (!isRecord(block)) return "";
	return stripAnsi(String(block.text || "")).trim();
}

export function safeThinking(block: unknown): string {
	if (!isRecord(block)) return "";
	return stripAnsi(String(block.thinking || "")).trim();
}

/** Returns the signature string for a redacted thinking block (Opus 4.7+), else null. */
export function redactedThinkingSignature(block: unknown): string | null {
	if (!isRecord(block)) return null;
	if (String(block.thinking || "").trim()) return null;
	const sig = block.signature;
	return typeof sig === "string" && sig.length > 0 ? sig : null;
}

export function thinkingHashKey(entryUuid: string | undefined, fallbackSource: string): string {
	return entryUuid
		? `thinking:${entryUuid}`
		: `thinking:${fallbackSource.slice(0, HASH_PREFIX_MAX)}`;
}

export function isSystemInjectedContent(text: string): boolean {
	return SYSTEM_CONTENT_PREFIXES.some((prefix) => text.startsWith(prefix));
}

/** Evict oldest 25% of a Set when it exceeds MAX_DEDUP_ENTRIES. */
export function evictOldEntries<T>(set: Set<T>): void {
	if (set.size <= MAX_DEDUP_ENTRIES) return;
	const evictCount = Math.floor(set.size * 0.25);
	const it = set.values();
	for (let i = 0; i < evictCount; i++) {
		const next = it.next();
		if (next.done) break;
		set.delete(next.value);
	}
}
