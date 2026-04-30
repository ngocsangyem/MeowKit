/**
 * End-to-end fixture canary — feeds tests/fixtures/sample-session.jsonl through
 * the parser and asserts ranges. Designed to fail loudly if Claude Code's
 * JSONL format changes (per researcher-02 §5).
 */

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { TranscriptParser, type TranscriptParserDelegate } from "../src/orchviz/parser/index.js";
import { SessionManager } from "../src/orchviz/session-manager.js";
import type { AgentEvent } from "../src/orchviz/protocol.js";

describe("orchviz canary — synthetic sample-session.jsonl", () => {
	it("emits a non-trivial event stream covering ≥6 of 9 event types", () => {
		const fixturePath = path.resolve(__dirname, "fixtures", "sample-session.jsonl");
		const raw = fs.readFileSync(fixturePath, "utf-8");
		const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
		expect(lines.length).toBeGreaterThan(15);

		const events: AgentEvent[] = [];
		const manager = new SessionManager();
		const session = manager.create("test-sess", fixturePath);
		const delegate: TranscriptParserDelegate = {
			emit: (ev) => events.push(ev),
			elapsed: () => 0,
			getSession: (sid) => manager.get(sid),
			fireSessionLifecycle: () => {
				/* noop */
			},
			emitContextUpdate: () => {
				/* noop */
			},
		};
		const parser = new TranscriptParser(delegate);

		for (const line of lines) {
			parser.processTranscriptLine(
				line,
				"orchestrator",
				session.pendingToolCalls,
				session.seenToolUseIds,
				"test-sess",
				session.seenMessageHashes,
			);
		}

		// Filter context_update which is high-volume noise.
		const signal = events.filter((e) => e.type !== "context_update");
		expect(signal.length).toBeGreaterThanOrEqual(15);

		const types = new Set(signal.map((e) => e.type));
		// Expect: message, tool_call_start, tool_call_end, model_detected,
		// subagent_dispatch, agent_spawn, subagent_return, agent_complete (8 types).
		expect(types.size).toBeGreaterThanOrEqual(6);
		expect(types.has("model_detected")).toBe(true);
		expect(types.has("tool_call_start")).toBe(true);
		expect(types.has("tool_call_end")).toBe(true);
		expect(types.has("subagent_dispatch")).toBe(true);

		// Sidechain entry should NOT have produced a message.
		const sidechainMsgs = signal.filter(
			(e) => e.type === "message" && (e.payload.content as string)?.includes("side branch"),
		);
		expect(sidechainMsgs).toHaveLength(0);

		// Duplicated uuid (last line repeats first user message) should not double-emit.
		const userMsgs = signal.filter(
			(e) => e.type === "message" && e.payload.role === "user" && (e.payload.content as string)?.includes("build me a feature"),
		);
		expect(userMsgs).toHaveLength(1);

		// Redacted thinking → exactly one redacted=true event.
		const redacted = signal.filter(
			(e) => e.type === "message" && e.payload.role === "thinking" && e.payload.redacted === true,
		);
		expect(redacted).toHaveLength(1);
	});
});
