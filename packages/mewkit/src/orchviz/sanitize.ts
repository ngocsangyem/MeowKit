/**
 * Combined sanitization for events leaving the server (SSE / API).
 * - stripAnsi  → defense vs ANSI-injection (red-team Critical #1)
 * - scrubSecrets → defense vs key/PEM leak (red-team Medium #13 / Q3)
 * - newline scrubbing → defense vs SSE frame injection (red-team RT2 #2)
 *
 * Recursive: walks every string in nested objects/arrays.
 */

import type { AgentEvent } from "./protocol.js";
import { stripAnsi } from "./parser/strip-ansi.js";
import { scrubSecrets } from "./redact.js";

function sanitizeString(s: string): string {
	// Strip ANSI, scrub secrets, then collapse \r\n / \n that would break SSE frames.
	const cleaned = scrubSecrets(stripAnsi(s));
	return cleaned.replace(/\r\n|\r|\n/g, " ");
}

function sanitizeValue(v: unknown): unknown {
	if (typeof v === "string") return sanitizeString(v);
	if (Array.isArray(v)) return v.map(sanitizeValue);
	if (v && typeof v === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
			out[k] = sanitizeValue(val);
		}
		return out;
	}
	return v;
}

export function sanitizeEvent(event: AgentEvent): AgentEvent {
	return {
		time: event.time,
		type: event.type,
		payload: sanitizeValue(event.payload) as Record<string, unknown>,
		...(event.sessionId ? { sessionId: event.sessionId } : {}),
	};
}
