/**
 * Token estimation utilities (~4 chars per token).
 *
 * Ported verbatim from patoles/agent-flow @ 59ccf4e
 *   Original: extension/src/token-estimator.ts
 *   License:  Apache-2.0 (see ../../NOTICE)
 *
 * Lives in this neutral module (not under any command subtree) so it has no
 * dependency on removed code. It is the canonical heuristic the `context-audit`
 * skill cites (that skill re-implements the same chars/4 rule in bash; it does
 * not import this module). The five tuning constants are inlined and standalone.
 */

const CHARS_PER_TOKEN = 4;
const MIN_TOKEN_ESTIMATE = 10;
const FALLBACK_TOKEN_ESTIMATE = 200;
const GREP_TOKEN_MULTIPLIER = 0.5;
const DEFAULT_TOKEN_MULTIPLIER = 0.3;

export function estimateTokensFromContent(content: unknown): number {
	if (typeof content === "string") {
		return Math.max(Math.ceil(content.length / CHARS_PER_TOKEN), MIN_TOKEN_ESTIMATE);
	}
	if (Array.isArray(content)) {
		let total = 0;
		for (const item of content) {
			if (typeof item === "string") total += item.length;
			else if (item && typeof item === "object" && "text" in item) {
				total += String((item as { text?: unknown }).text || "").length;
			}
		}
		return Math.max(Math.ceil(total / CHARS_PER_TOKEN), MIN_TOKEN_ESTIMATE);
	}
	return FALLBACK_TOKEN_ESTIMATE;
}

export function estimateTokensFromText(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateTokenCost(toolName: string, result: string): number {
	const baseTokens = Math.ceil(result.length / CHARS_PER_TOKEN);
	if (toolName === "Read") return baseTokens;
	if (toolName === "Grep" || toolName === "Glob") {
		return Math.ceil(baseTokens * GREP_TOKEN_MULTIPLIER);
	}
	return Math.ceil(baseTokens * DEFAULT_TOKEN_MULTIPLIER);
}
