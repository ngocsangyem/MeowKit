/**
 * SseRelay pause behavior — debounce + reconnect registry.
 *
 * Phase-06 coverage:
 *   - pause_started buffered for PAUSE_MIN_DURATION_MS before emit
 *   - pause_cleared inside the window cancels both events
 *   - pause_cleared with no toolUseId still cancels heuristic by (session, agent)
 *   - Reconnect after ring-buffer eviction still replays active pause via pauseRegistry
 *   - pauseRegistry cleared on pause_cleared
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ServerResponse, IncomingMessage } from "node:http";
import { SseRelay } from "../sse-handler.js";
import type { AgentEvent } from "../../protocol.js";
import { PAUSE_MIN_DURATION_MS, MAX_SSE_BUFFER } from "../../constants.js";

// ── Fake response that captures writes ────────────────────────────────────────

interface FakeResponse {
	writes: string[];
	headers?: Record<string, string | number>;
	status?: number;
	ended: boolean;
	listeners: Map<string, Array<() => void>>;
}

function makeFakeRes(): { res: ServerResponse; out: FakeResponse } {
	const out: FakeResponse = { writes: [], ended: false, listeners: new Map() };
	const res = {
		writeHead(status: number, headers: Record<string, string | number>) {
			out.status = status;
			out.headers = headers;
		},
		write(chunk: string) {
			out.writes.push(chunk);
			return true;
		},
		end() {
			out.ended = true;
		},
		on(event: string, cb: () => void) {
			const list = out.listeners.get(event) ?? [];
			list.push(cb);
			out.listeners.set(event, list);
		},
	} as unknown as ServerResponse;
	return { res, out };
}

function makeFakeReq(lastEventId?: string): IncomingMessage {
	return {
		headers: lastEventId ? { "last-event-id": lastEventId } : {},
		on() {
			/* noop */
		},
	} as unknown as IncomingMessage;
}

function pauseStarted(agent: string, toolUseId?: string): AgentEvent {
	return {
		time: 0,
		type: "pause_started",
		sessionId: "sess-01",
		payload: { agent, reason: "ask_user_question", toolUseId, detail: {} },
	};
}

function pauseCleared(agent: string, toolUseId?: string): AgentEvent {
	return {
		time: 1,
		type: "pause_cleared",
		sessionId: "sess-01",
		payload: { agent, reason: "ask_user_question", toolUseId, durationMs: 50 },
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SseRelay pause behavior", () => {
	let relay: SseRelay;

	beforeEach(() => {
		vi.useFakeTimers();
		relay = new SseRelay();
	});

	afterEach(() => {
		relay.stop();
		vi.useRealTimers();
	});

	it("buffers pause_started for PAUSE_MIN_DURATION_MS before emitting", () => {
		const { res, out } = makeFakeRes();
		relay.handle(makeFakeReq(), res);
		out.writes.length = 0; // clear ": connected" preamble

		relay.publish(pauseStarted("main", "tu-1"));
		expect(out.writes.filter((w) => w.includes("pause_started"))).toHaveLength(0);

		vi.advanceTimersByTime(PAUSE_MIN_DURATION_MS);
		expect(out.writes.some((w) => w.includes("pause_started"))).toBe(true);
	});

	it("pause_cleared inside debounce window cancels both events", () => {
		const { res, out } = makeFakeRes();
		relay.handle(makeFakeReq(), res);
		out.writes.length = 0;

		relay.publish(pauseStarted("main", "tu-2"));
		vi.advanceTimersByTime(PAUSE_MIN_DURATION_MS - 50);
		relay.publish(pauseCleared("main", "tu-2"));
		vi.advanceTimersByTime(500); // well past the original debounce window

		expect(out.writes.some((w) => w.includes("pause_started"))).toBe(false);
		expect(out.writes.some((w) => w.includes("pause_cleared"))).toBe(false);
	});

	it("pause_cleared without toolUseId cancels heuristic pause for same agent", () => {
		const { res, out } = makeFakeRes();
		relay.handle(makeFakeReq(), res);
		out.writes.length = 0;

		// Heuristic pause has no toolUseId
		relay.publish(pauseStarted("main"));
		vi.advanceTimersByTime(50);
		relay.publish(pauseCleared("main")); // same (session, agent), no toolUseId
		vi.advanceTimersByTime(500);

		expect(out.writes.some((w) => w.includes("pause_started"))).toBe(false);
		expect(out.writes.some((w) => w.includes("pause_cleared"))).toBe(false);
	});

	it("emits pause_cleared normally when no buffered pause_started exists", () => {
		const { res, out } = makeFakeRes();
		relay.handle(makeFakeReq(), res);
		out.writes.length = 0;

		// No pause_started in flight; pause_cleared should pass straight through
		relay.publish(pauseCleared("main", "tu-3"));
		expect(out.writes.some((w) => w.includes("pause_cleared"))).toBe(true);
	});

	it("reconnecting client replays active pause from pauseRegistry after ring-buffer eviction", () => {
		// First client receives the pause normally
		const { res: res1, out: out1 } = makeFakeRes();
		relay.handle(makeFakeReq(), res1);
		out1.writes.length = 0;

		relay.publish(pauseStarted("main", "tu-4"));
		vi.advanceTimersByTime(PAUSE_MIN_DURATION_MS);

		// Push more events than the ring buffer holds to evict the pause_started
		for (let i = 0; i < MAX_SSE_BUFFER + 10; i++) {
			relay.publish({
				time: i,
				type: "agent_idle",
				sessionId: "sess-01",
				payload: { agent: "filler" },
			});
		}

		// New client reconnects with no Last-Event-ID
		const { res: res2, out: out2 } = makeFakeRes();
		relay.handle(makeFakeReq(), res2);

		// Reconnect replay should still include the pause_started via pauseRegistry
		expect(out2.writes.some((w) => w.includes("pause_started") && w.includes("tu-4"))).toBe(true);
	});

	it("pauseRegistry stores by full key — concurrent pauses on same agent with different toolUseIds do not collide", () => {
		const { res } = makeFakeRes();
		relay.handle(makeFakeReq(), res);

		// Two distinct pauses on the same (session, agent) but different toolUseIds.
		relay.publish(pauseStarted("main", "tu-A"));
		vi.advanceTimersByTime(PAUSE_MIN_DURATION_MS);
		relay.publish(pauseStarted("main", "tu-B"));
		vi.advanceTimersByTime(PAUSE_MIN_DURATION_MS);

		// Evict ring buffer
		for (let i = 0; i < MAX_SSE_BUFFER + 10; i++) {
			relay.publish({
				time: i,
				type: "agent_idle",
				sessionId: "sess-01",
				payload: { agent: "filler" },
			});
		}

		// Both active pauses must replay on reconnect — second pause must NOT
		// overwrite the first in the registry.
		const { res: res2, out: out2 } = makeFakeRes();
		relay.handle(makeFakeReq(), res2);

		expect(out2.writes.some((w) => w.includes("pause_started") && w.includes("tu-A"))).toBe(true);
		expect(out2.writes.some((w) => w.includes("pause_started") && w.includes("tu-B"))).toBe(true);
	});

	it("pause_cleared removes the agent from pauseRegistry so no stuck pause survives ring-buffer eviction", () => {
		const { res: res1 } = makeFakeRes();
		relay.handle(makeFakeReq(), res1);

		relay.publish(pauseStarted("main", "tu-5"));
		vi.advanceTimersByTime(PAUSE_MIN_DURATION_MS);
		relay.publish(pauseCleared("main", "tu-5"));

		// Push enough events to evict both pause_started and pause_cleared from the ring buffer.
		for (let i = 0; i < MAX_SSE_BUFFER + 10; i++) {
			relay.publish({
				time: i,
				type: "agent_idle",
				sessionId: "sess-01",
				payload: { agent: "filler" },
			});
		}

		// New client reconnects: pauseRegistry was cleared on pause_cleared, ring buffer
		// has evicted the original events — nothing should resurrect a phantom pause.
		const { res: res2, out: out2 } = makeFakeRes();
		relay.handle(makeFakeReq(), res2);

		expect(out2.writes.some((w) => w.includes("pause_started") && w.includes("tu-5"))).toBe(false);
	});
});
