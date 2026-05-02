/**
 * Smoke tests for handle-system.ts — stop_hook_summary detection.
 *
 * CRITICAL: Tests exercise the FULL parser pipeline (TranscriptParser.processTranscriptLine)
 * to verify the parser/index.ts guard fix (red-team #5) is in place.
 * Calling handleSystemEntry() in isolation would not catch a missing dispatch in index.ts.
 */

import { describe, it, expect, vi } from "vitest";
import { TranscriptParser } from "../index.js";
import type { TranscriptParserDelegate } from "../index.js";
import type { AgentEvent, WatchedSession } from "../../protocol.js";

// ─── Minimal delegate factory ─────────────────────────────────────────────────

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

// ─── Real stop_hook_summary JSONL line (observed in real transcripts) ─────────

const STOP_HOOK_SUMMARY_LINE = JSON.stringify({
	type: "system",
	subtype: "stop_hook_summary",
	preventedContinuation: true,
	stopReason: "pre-commit hook blocked commit",
	hookInfos: [{ command: "npx lint-staged", exitCode: 1 }],
});

const SESSION_ID = "sess-test-01";

describe("handle-system.ts via full parser pipeline", () => {
	it("processTranscriptLine dispatches stop_hook_summary → pause_started{hook_blocked}", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));

		parser.processTranscriptLine(
			STOP_HOOK_SUMMARY_LINE,
			"orchestrator",
			new Map(),
			new Set(),
			SESSION_ID,
		);

		// Should have emitted exactly one pause_started event
		const pauseEvents = events.filter((e) => e.type === "pause_started");
		expect(pauseEvents).toHaveLength(1);

		const evt = pauseEvents[0];
		expect(evt.type).toBe("pause_started");
		const payload = evt.payload as {
			agent: string;
			reason: string;
			detail?: { hookCommand?: string; hookReason?: string };
		};
		expect(payload.reason).toBe("hook_blocked");
		expect(payload.agent).toBe("orchestrator");
		expect(payload.detail?.hookCommand).toBe("npx lint-staged");
		expect(payload.detail?.hookReason).toBe("pre-commit hook blocked commit");
	});

	it("does NOT emit for stop_hook_summary with preventedContinuation=false", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));

		const line = JSON.stringify({
			type: "system",
			subtype: "stop_hook_summary",
			preventedContinuation: false,
			stopReason: "hook ran but did not block",
		});

		parser.processTranscriptLine(line, "orchestrator", new Map(), new Set(), SESSION_ID);

		const pauseEvents = events.filter((e) => e.type === "pause_started");
		expect(pauseEvents).toHaveLength(0);
	});

	it("does NOT emit for system entries with unknown subtype", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));

		const line = JSON.stringify({
			type: "system",
			subtype: "some_other_system_event",
			preventedContinuation: true,
		});

		parser.processTranscriptLine(line, "orchestrator", new Map(), new Set(), SESSION_ID);

		const pauseEvents = events.filter((e) => e.type === "pause_started");
		expect(pauseEvents).toHaveLength(0);
	});

	it("does NOT emit for type=progress lines (guard not broken)", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));

		// progress lines must still be handled by handleProgressEvent, not system handler
		const line = JSON.stringify({ type: "progress", content: "some progress" });
		parser.processTranscriptLine(line, "orchestrator", new Map(), new Set(), SESSION_ID);

		const pauseEvents = events.filter((e) => e.type === "pause_started");
		expect(pauseEvents).toHaveLength(0);
	});

	it("handles missing hookInfos gracefully — hookCommand is undefined", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));

		const line = JSON.stringify({
			type: "system",
			subtype: "stop_hook_summary",
			preventedContinuation: true,
			stopReason: "hook blocked",
			// hookInfos intentionally absent
		});

		parser.processTranscriptLine(line, "orchestrator", new Map(), new Set(), SESSION_ID);

		const pauseEvents = events.filter((e) => e.type === "pause_started");
		expect(pauseEvents).toHaveLength(1);
		const payload = pauseEvents[0].payload as { detail?: { hookCommand?: string } };
		expect(payload.detail?.hookCommand).toBeUndefined();
	});

	it("handles missing stopReason — hookReason defaults to empty string", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));

		const line = JSON.stringify({
			type: "system",
			subtype: "stop_hook_summary",
			preventedContinuation: true,
			hookInfos: [{ command: "pre-push" }],
			// stopReason intentionally absent
		});

		parser.processTranscriptLine(line, "orchestrator", new Map(), new Set(), SESSION_ID);

		const pauseEvents = events.filter((e) => e.type === "pause_started");
		expect(pauseEvents).toHaveLength(1);
		const payload = pauseEvents[0].payload as { detail?: { hookReason?: string } };
		expect(payload.detail?.hookReason).toBe("");
	});
});

// ─── hook_blocked clear tests (Issue 1 regression guard) ─────────────────────

const ASSISTANT_TEXT_LINE = (agentNameInTranscript: string) =>
	JSON.stringify({
		type: "assistant",
		message: {
			role: "assistant",
			content: [{ type: "text", text: "Continuing after hook was resolved." }],
		},
		uuid: `uuid-${agentNameInTranscript}`,
	});

describe("hook_blocked pause_cleared lifecycle", () => {
	it("emits pause_cleared when SAME agent emits assistant text after hook_blocked", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));

		// Feed stop_hook_summary with agent "main"
		const hookLine = JSON.stringify({
			type: "system",
			subtype: "stop_hook_summary",
			preventedContinuation: true,
			stopReason: "pre-commit hook blocked",
		});
		parser.processTranscriptLine(hookLine, "main", new Map(), new Set(), SESSION_ID);

		const pauseStarted = events.filter((e) => e.type === "pause_started");
		expect(pauseStarted).toHaveLength(1);
		const startPayload = pauseStarted[0].payload as { agent: string; reason: string };
		expect(startPayload.agent).toBe("main");
		expect(startPayload.reason).toBe("hook_blocked");

		// Feed assistant text for the SAME agent ("main") — should clear the pause
		parser.processTranscriptLine(
			ASSISTANT_TEXT_LINE("main"),
			"main",
			new Map(),
			new Set(),
			SESSION_ID,
		);

		const pauseCleared = events.filter((e) => e.type === "pause_cleared");
		expect(pauseCleared).toHaveLength(1);
		const clearPayload = pauseCleared[0].payload as { agent: string; reason: string };
		expect(clearPayload.agent).toBe("main");
		expect(clearPayload.reason).toBe("hook_blocked");
	});

	it("does NOT emit pause_cleared when a DIFFERENT agent emits assistant text", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));

		// Feed stop_hook_summary with agent "main"
		const hookLine = JSON.stringify({
			type: "system",
			subtype: "stop_hook_summary",
			preventedContinuation: true,
			stopReason: "pre-commit hook blocked",
		});
		parser.processTranscriptLine(hookLine, "main", new Map(), new Set(), SESSION_ID);

		expect(events.filter((e) => e.type === "pause_started")).toHaveLength(1);

		// Feed assistant text for a DIFFERENT agent ("researcher-1") — must NOT clear main's pause
		parser.processTranscriptLine(
			ASSISTANT_TEXT_LINE("researcher-1"),
			"researcher-1",
			new Map(),
			new Set(),
			SESSION_ID,
		);

		const pauseCleared = events.filter((e) => e.type === "pause_cleared");
		expect(pauseCleared).toHaveLength(0);
	});
});

describe("parser guard fix verification (red-team #5)", () => {
	it("system lines reach handler — NOT silently dropped by the early-return guard", () => {
		// This test explicitly verifies the guard fix in parser/index.ts:
		//   if (parsed.type === "system") { handleSystemEntry(...); return; }
		// If the guard fix is missing, this test fails (0 pause events emitted).
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));

		parser.processTranscriptLine(
			STOP_HOOK_SUMMARY_LINE,
			"orchestrator",
			new Map(),
			new Set(),
			SESSION_ID,
		);

		// The guard fix makes this reachable. Without the fix: 0 events.
		expect(events.some((e) => e.type === "pause_started")).toBe(true);
	});

	it("non-user non-assistant lines (other than system/progress) are still dropped", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));

		// 'meta' type — unknown, should be dropped
		const line = JSON.stringify({ type: "meta", data: "something" });
		parser.processTranscriptLine(line, "orchestrator", new Map(), new Set(), SESSION_ID);

		// No events other than maybe context_update; no pause events
		expect(events.filter((e) => e.type === "pause_started")).toHaveLength(0);
	});
});
