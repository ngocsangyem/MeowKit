import { describe, expect, it, beforeEach } from "vitest";
import type { AgentEvent, WatchedSession } from "../src/orchviz/protocol.js";
import { TranscriptParser, type TranscriptParserDelegate } from "../src/orchviz/parser/index.js";
import { SessionManager } from "../src/orchviz/session-manager.js";

function makeHarness(): {
	parser: TranscriptParser;
	manager: SessionManager;
	events: AgentEvent[];
	session: WatchedSession;
} {
	const events: AgentEvent[] = [];
	const manager = new SessionManager();
	const session = manager.create("test-sess", "/dummy/path.jsonl");
	const delegate: TranscriptParserDelegate = {
		emit: (ev: AgentEvent, sid?: string) => {
			events.push(sid ? { ...ev, sessionId: sid } : ev);
		},
		elapsed: () => 0,
		getSession: (sid: string) => manager.get(sid),
		fireSessionLifecycle: () => {
			/* noop */
		},
		emitContextUpdate: () => {
			/* noop */
		},
	};
	return { parser: new TranscriptParser(delegate), manager, events, session };
}

function feed(parser: TranscriptParser, session: WatchedSession, line: string): void {
	parser.processTranscriptLine(
		line,
		"orchestrator",
		session.pendingToolCalls,
		session.seenToolUseIds,
		session.sessionId,
		session.seenMessageHashes,
	);
}

describe("TranscriptParser", () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});

	it("skips entries with type=ai-title", () => {
		feed(
			h.parser,
			h.session,
			JSON.stringify({ type: "ai-title", sessionId: "test", title: "X" }),
		);
		expect(h.events.filter((e) => e.type !== "context_update")).toHaveLength(0);
	});

	it("skips entries with isSidechain=true", () => {
		feed(
			h.parser,
			h.session,
			JSON.stringify({
				type: "user",
				sessionId: "test",
				isSidechain: true,
				message: { role: "user", content: "branched" },
			}),
		);
		expect(h.events.filter((e) => e.type === "message")).toHaveLength(0);
	});

	it("emits redacted thinking event when thinking='' and signature is set", () => {
		feed(
			h.parser,
			h.session,
			JSON.stringify({
				type: "assistant",
				sessionId: "test-sess",
				uuid: "redact1",
				message: {
					role: "assistant",
					content: [{ type: "thinking", thinking: "", signature: "sig-x" }],
				},
			}),
		);
		const msgs = h.events.filter((e) => e.type === "message");
		expect(msgs.length).toBe(1);
		expect(msgs[0].payload.role).toBe("thinking");
		expect(msgs[0].payload.redacted).toBe(true);
	});

	it("dedups by uuid (same uuid twice → 1 message)", () => {
		const line = JSON.stringify({
			type: "user",
			sessionId: "test-sess",
			uuid: "u-dup",
			message: { role: "user", content: "same content" },
		});
		feed(h.parser, h.session, line);
		feed(h.parser, h.session, line);
		expect(h.events.filter((e) => e.type === "message")).toHaveLength(1);
	});

	it("filters SYSTEM_CONTENT_PREFIXES from user text", () => {
		feed(
			h.parser,
			h.session,
			JSON.stringify({
				type: "user",
				sessionId: "test-sess",
				uuid: "u-sys",
				message: {
					role: "user",
					content: "This session is being continued from a previous conversation.",
				},
			}),
		);
		expect(h.events.filter((e) => e.type === "message")).toHaveLength(0);
	});

	it("emits tool_call_start + model_detected for assistant turns", () => {
		feed(
			h.parser,
			h.session,
			JSON.stringify({
				type: "assistant",
				sessionId: "test-sess",
				uuid: "a-1",
				message: {
					role: "assistant",
					model: "claude-opus-4-7",
					content: [
						{ type: "text", text: "ok" },
						{ type: "tool_use", id: "tu-1", name: "Read", input: { file_path: "src/foo.ts" } },
					],
				},
			}),
		);
		const types = new Set(h.events.map((e) => e.type));
		expect(types.has("model_detected")).toBe(true);
		expect(types.has("tool_call_start")).toBe(true);
	});

	it("does not throw on malformed JSON", () => {
		expect(() => feed(h.parser, h.session, "not-json{")).not.toThrow();
		expect(h.events.filter((e) => e.type === "message")).toHaveLength(0);
	});
});
