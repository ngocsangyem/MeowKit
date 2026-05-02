/**
 * HOOK_BLOCKED_MAX_MS fail-open auto-clear — phase-06 §7 safety cap.
 *
 * If a hook_blocked pause is never cleared by an assistant text from the
 * same agent (the normal clear path), the parser's 5-min safety timer must
 * emit pause_cleared so the UI doesn't get permanently stuck.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TranscriptParser } from "../index.js";
import type { TranscriptParserDelegate } from "../index.js";
import type { AgentEvent } from "../../protocol.js";
import { HOOK_BLOCKED_MAX_MS } from "../../constants.js";

function makeDelegate(events: AgentEvent[]): TranscriptParserDelegate {
	return {
		emit(event: AgentEvent) {
			events.push(event);
		},
		elapsed() {
			return 0;
		},
		getSession() {
			return undefined;
		},
		fireSessionLifecycle: vi.fn(),
		emitContextUpdate: vi.fn(),
	};
}

function stopHookSummaryLine(): string {
	return JSON.stringify({
		type: "system",
		sessionId: "sess-01",
		subtype: "stop_hook_summary",
		preventedContinuation: true,
		stopReason: "Build is failing",
		hookInfos: [{ command: "sh hooks/pre-tool.sh" }],
	});
}

describe("hook_blocked safety cap (HOOK_BLOCKED_MAX_MS)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("auto-emits pause_cleared after HOOK_BLOCKED_MAX_MS if no assistant text clears it", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		parser.processTranscriptLine(stopHookSummaryLine(), "main", new Map(), new Set(), "sess-01");

		// Sanity: pause_started{hook_blocked} fired
		expect(events.some((e) => e.type === "pause_started")).toBe(true);

		// Pre-cap: no pause_cleared yet
		expect(events.some((e) => e.type === "pause_cleared")).toBe(false);

		// Advance past the cap
		vi.advanceTimersByTime(HOOK_BLOCKED_MAX_MS + 100);

		// Fail-open: pause_cleared{hook_blocked} should now have fired
		const cleared = events.find((e) => e.type === "pause_cleared");
		expect(cleared).toBeDefined();
		const payload = cleared!.payload as Record<string, unknown>;
		expect(payload.reason).toBe("hook_blocked");
		expect(payload.agent).toBe("main");
		expect(typeof payload.durationMs).toBe("number");
		expect(payload.durationMs as number).toBeGreaterThanOrEqual(HOOK_BLOCKED_MAX_MS);
	});

	it("does NOT auto-clear if the assistant-text path already cleared the block first", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		parser.processTranscriptLine(stopHookSummaryLine(), "main", new Map(), new Set(), "sess-01");

		// Same agent emits assistant text → normal clear path
		const assistantTextLine = JSON.stringify({
			type: "assistant",
			sessionId: "sess-01",
			message: { role: "assistant", content: [{ type: "text", text: "OK, retrying" }] },
		});
		parser.processTranscriptLine(assistantTextLine, "main", new Map(), new Set(), "sess-01");

		const clearedFromTextPath = events.filter((e) => e.type === "pause_cleared");
		expect(clearedFromTextPath).toHaveLength(1);

		// Advance past the cap — should NOT add a second pause_cleared
		vi.advanceTimersByTime(HOOK_BLOCKED_MAX_MS + 100);
		const allCleared = events.filter((e) => e.type === "pause_cleared");
		expect(allCleared).toHaveLength(1);
	});
});
