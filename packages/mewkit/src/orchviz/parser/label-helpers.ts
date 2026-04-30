/**
 * Session-label extraction helpers.
 * Split out of parser/index.ts to keep under the 200-LOC server-side cap.
 */

import type { TranscriptEntry, WatchedSession } from "../protocol.js";
import { SESSION_LABEL_MAX, SESSION_LABEL_TRUNCATED } from "../constants.js";
import { isSystemInjectedContent, safeText } from "./utils.js";

export function extractUserMessageText(entry: TranscriptEntry): string | null {
	const msg = entry.message;
	if (!msg) return null;
	if (typeof msg.content === "string" && msg.content.trim()) {
		const text = msg.content.trim();
		return isSystemInjectedContent(text) ? null : text;
	}
	if (Array.isArray(msg.content)) {
		for (const block of msg.content) {
			if (block.type === "text" && "text" in block) {
				const text = safeText(block);
				if (text && !isSystemInjectedContent(text)) return text;
			}
		}
	}
	return null;
}

export function truncateLabel(text: string): string {
	const firstLine = text.split("\n")[0].trim();
	if (firstLine.length <= SESSION_LABEL_MAX) return firstLine;
	return firstLine.slice(0, SESSION_LABEL_TRUNCATED) + "..";
}

export function applySessionLabel(
	session: WatchedSession,
	entry: TranscriptEntry,
): boolean {
	if (session.labelSet) return false;
	if (entry.type !== "user") return false;
	const text = extractUserMessageText(entry);
	if (!text) return false;
	session.label = truncateLabel(text);
	session.labelSet = true;
	return true;
}
