/**
 * Parser tests for Task/Agent tool_use → agent_spawn emission.
 *
 * Cover the regression where two siblings sharing a display label (e.g. both
 * `subagent_type: "researcher"`) collapse to one node on the canvas. With the
 * dedup-by-tool_use-id change, both spawns fire and the frontend reactivates
 * the existing node.
 */

import { describe, it, expect, vi } from "vitest";
import { TranscriptParser } from "../index.js";
import type { TranscriptParserDelegate } from "../index.js";
import type { AgentEvent, WatchedSession } from "../../protocol.js";
import { makeMockSession } from "./make-mock-session.js";

const SESSION_ID = "sess-spawn";
const AGENT = "orchestrator";

function makeDelegate(
	events: AgentEvent[],
	session: WatchedSession,
): TranscriptParserDelegate {
	return {
		emit(event) {
			events.push(event);
		},
		elapsed() {
			return 0;
		},
		getSession() {
			return session;
		},
		fireSessionLifecycle: vi.fn(),
		emitContextUpdate: vi.fn(),
	};
}

function assistantTaskLine(toolId: string, input: Record<string, unknown>, name = "Task"): string {
	return JSON.stringify({
		type: "assistant",
		sessionId: SESSION_ID,
		message: {
			role: "assistant",
			content: [{ type: "tool_use", id: toolId, name, input }],
		},
	});
}

function spawnEvents(events: AgentEvent[]) {
	return events.filter((e) => e.type === "agent_spawn");
}

describe("handleToolUse — Task/Agent spawn emission", () => {
	it("happy path — two unique descriptions emit two distinct spawns", () => {
		const events: AgentEvent[] = [];
		const session = makeMockSession();
		const parser = new TranscriptParser(makeDelegate(events, session));
		const pending = new Map();
		const seen = new Set<string>();

		parser.processTranscriptLine(
			assistantTaskLine("toolu_a", { description: "research auth", subagent_type: "researcher" }),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);
		parser.processTranscriptLine(
			assistantTaskLine("toolu_b", { description: "research storage", subagent_type: "researcher" }),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		const spawns = spawnEvents(events);
		expect(spawns).toHaveLength(2);
		expect(spawns.map((e) => (e.payload as { name: string }).name)).toEqual([
			"research auth",
			"research storage",
		]);
	});

	it("same-description siblings — both fire with same display name (frontend reactivates)", () => {
		const events: AgentEvent[] = [];
		const session = makeMockSession();
		const parser = new TranscriptParser(makeDelegate(events, session));
		const pending = new Map();
		const seen = new Set<string>();

		parser.processTranscriptLine(
			assistantTaskLine("toolu_a", { description: "Research", subagent_type: "researcher" }),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);
		parser.processTranscriptLine(
			assistantTaskLine("toolu_b", { description: "Research", subagent_type: "researcher" }),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		const spawns = spawnEvents(events);
		expect(spawns).toHaveLength(2);
		for (const e of spawns) {
			expect((e.payload as { name: string }).name).toBe("Research");
		}
	});

	it("same subagent_type, no description — both fire (this is the production bug case)", () => {
		const events: AgentEvent[] = [];
		const session = makeMockSession();
		const parser = new TranscriptParser(makeDelegate(events, session));
		const pending = new Map();
		const seen = new Set<string>();

		parser.processTranscriptLine(
			assistantTaskLine("toolu_a", { subagent_type: "researcher" }, "Agent"),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);
		parser.processTranscriptLine(
			assistantTaskLine("toolu_b", { subagent_type: "researcher" }, "Agent"),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		const spawns = spawnEvents(events);
		expect(spawns).toHaveLength(2);
		expect(spawns.map((e) => (e.payload as { name: string }).name)).toEqual([
			"researcher",
			"researcher",
		]);
	});

	it("pure fallback — empty input emits subagent-<id6> with distinct suffixes", () => {
		const events: AgentEvent[] = [];
		const session = makeMockSession();
		const parser = new TranscriptParser(makeDelegate(events, session));
		const pending = new Map();
		const seen = new Set<string>();

		parser.processTranscriptLine(
			assistantTaskLine("toolu_aaaaaa", {}),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);
		parser.processTranscriptLine(
			assistantTaskLine("toolu_bbbbbb", {}),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		const spawns = spawnEvents(events);
		expect(spawns).toHaveLength(2);
		const names = spawns.map((e) => (e.payload as { name: string }).name);
		expect(names[0]).toMatch(/^subagent-/);
		expect(names[1]).toMatch(/^subagent-/);
		expect(names[0]).not.toBe(names[1]);
	});

	it("ANSI/newline normalization — two spawns with equivalent labels both fire", () => {
		const events: AgentEvent[] = [];
		const session = makeMockSession();
		const parser = new TranscriptParser(makeDelegate(events, session));
		const pending = new Map();
		const seen = new Set<string>();

		parser.processTranscriptLine(
			assistantTaskLine("toolu_a", { description: "Foo\nBar" }),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);
		parser.processTranscriptLine(
			assistantTaskLine("toolu_b", { description: "Foo Bar" }),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		const spawns = spawnEvents(events);
		expect(spawns).toHaveLength(2);
		for (const e of spawns) {
			expect((e.payload as { name: string }).name).toBe("Foo Bar");
		}
	});

	it("length-guarded short tool_use id — empty input falls back to plain 'subagent' without crash", () => {
		const events: AgentEvent[] = [];
		const session = makeMockSession();
		const parser = new TranscriptParser(makeDelegate(events, session));
		const pending = new Map();
		const seen = new Set<string>();

		parser.processTranscriptLine(
			assistantTaskLine("abc", {}),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		const spawns = spawnEvents(events);
		expect(spawns).toHaveLength(1);
		expect((spawns[0].payload as { name: string }).name).toBe("subagent");
	});

	it("regression — same tool_use id processed twice fires only one spawn", () => {
		const events: AgentEvent[] = [];
		const session = makeMockSession();
		const parser = new TranscriptParser(makeDelegate(events, session));
		const pendingA = new Map();
		const seenA = new Set<string>();
		const pendingB = new Map();
		const seenB = new Set<string>();

		parser.processTranscriptLine(
			assistantTaskLine("toolu_dup", { subagent_type: "researcher" }),
			AGENT,
			pendingA,
			seenA,
			SESSION_ID,
		);
		// Re-process via a different ctxSeen (simulates a retry/replay path).
		parser.processTranscriptLine(
			assistantTaskLine("toolu_dup", { subagent_type: "researcher" }),
			AGENT,
			pendingB,
			seenB,
			SESSION_ID,
		);

		expect(spawnEvents(events)).toHaveLength(1);
	});
});
