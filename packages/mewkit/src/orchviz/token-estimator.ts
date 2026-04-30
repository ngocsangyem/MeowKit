/**
 * Token estimation utilities (~4 chars per token).
 *
 * Ported verbatim from patoles/agent-flow @ 59ccf4e
 *   Original: extension/src/token-estimator.ts
 *   License:  Apache-2.0 (see ../../NOTICE)
 */

import {
	CHARS_PER_TOKEN,
	MIN_TOKEN_ESTIMATE,
	FALLBACK_TOKEN_ESTIMATE,
	GREP_TOKEN_MULTIPLIER,
	DEFAULT_TOKEN_MULTIPLIER,
} from "./constants.js";

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
