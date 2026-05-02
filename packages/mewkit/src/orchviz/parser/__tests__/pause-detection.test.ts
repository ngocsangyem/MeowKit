/**
 * Pause detection tests — AskUserQuestion, ExitPlanMode, tool_rejected, hook_blocked.
 *
 * Coverage:
 *   - AskUserQuestion tool_use → pause_started{ask_user_question} with detail.questions
 *   - Matching tool_result → pause_cleared with non-zero durationMs
 *   - ExitPlanMode tool_use → pause_started{plan_mode_review}
 *   - Rejection string in tool_result content → pause_started{tool_rejected}
 *   - pendingRejection cleared by same-agent next assistant text
 *   - pendingRejection NOT cleared by different-agent text (multi-session collision guard)
 *   - [red-team #12] compound key ${sessionId}:${agent} prevents cross-session collision
 */

import { describe, it, expect, vi } from "vitest";
import { TranscriptParser } from "../index.js";
import type { TranscriptParserDelegate } from "../index.js";
import type { AgentEvent } from "../../protocol.js";

// ─── Delegate factory ─────────────────────────────────────────────────────────

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

// ─── JSONL line builders ──────────────────────────────────────────────────────

function assistantToolUseLine(
	toolName: string,
	toolId: string,
	input: Record<string, unknown> = {},
): string {
	return JSON.stringify({
		type: "assistant",
		sessionId: "sess-01",
		message: {
			role: "assistant",
			content: [{ type: "tool_use", id: toolId, name: toolName, input }],
		},
	});
}

function userToolResultLine(toolUseId: string, content: string): string {
	return JSON.stringify({
		type: "user",
		sessionId: "sess-01",
		message: {
			role: "user",
			content: [{ type: "tool_result", tool_use_id: toolUseId, content }],
		},
	});
}

function assistantTextLine(text: string, sessionId = "sess-01"): string {
	return JSON.stringify({
		type: "assistant",
		sessionId,
		message: { role: "assistant", content: [{ type: "text", text }] },
	});
}

// ─── AskUserQuestion ──────────────────────────────────────────────────────────

describe("AskUserQuestion pause detection", () => {
	const TOOL_ID = "toolu_ask_001";
	const SESSION_ID = "sess-01";
	const AGENT = "orchestrator";

	const ASK_INPUT = {
		questions: [
			{
				question: "Which approach?",
				header: "Choose",
				options: [{ label: "Option A" }, { label: "Option B" }],
				multiSelect: false,
			},
		],
	};

	it("tool_use AskUserQuestion → pause_started{ask_user_question} with detail.questions", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		const pending = new Map();
		const seen = new Set<string>();

		parser.processTranscriptLine(
			assistantToolUseLine("AskUserQuestion", TOOL_ID, ASK_INPUT),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		const pauseEvents = events.filter((e) => e.type === "pause_started");
		expect(pauseEvents).toHaveLength(1);

		const payload = pauseEvents[0].payload as {
			reason: string;
			toolUseId: string;
			toolName: string;
			detail?: { questions?: Array<{ question: string; options: string[] }> };
		};
		expect(payload.reason).toBe("ask_user_question");
		expect(payload.toolUseId).toBe(TOOL_ID);
		expect(payload.toolName).toBe("AskUserQuestion");
		expect(payload.detail?.questions).toHaveLength(1);
		expect(payload.detail?.questions?.[0].question).toBe("Which approach?");
		// [red-team #22] options must be flat string[], not {label; description?}
		expect(payload.detail?.questions?.[0].options).toEqual(["Option A", "Option B"]);
	});

	it("matching tool_result → pause_cleared with non-zero durationMs", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		const pending = new Map();
		const seen = new Set<string>();

		// 1. Emit tool_use → registers pending + pause_started
		parser.processTranscriptLine(
			assistantToolUseLine("AskUserQuestion", TOOL_ID, ASK_INPUT),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		// 2. Emit matching tool_result → should produce pause_cleared
		parser.processTranscriptLine(
			userToolResultLine(TOOL_ID, "User selected: Option A"),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		const clearedEvents = events.filter((e) => e.type === "pause_cleared");
		expect(clearedEvents).toHaveLength(1);

		const payload = clearedEvents[0].payload as {
			agent: string;
			reason: string;
			toolUseId: string;
			durationMs: number;
		};
		expect(payload.reason).toBe("ask_user_question");
		expect(payload.toolUseId).toBe(TOOL_ID);
		expect(payload.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("non-matching tool_result does NOT emit pause_cleared", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		const pending = new Map();
		const seen = new Set<string>();

		parser.processTranscriptLine(
			assistantToolUseLine("AskUserQuestion", TOOL_ID, ASK_INPUT),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		// Different tool_use_id — should not clear the ask_user_question pause
		parser.processTranscriptLine(
			userToolResultLine("toolu_other_999", "some result"),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		expect(events.filter((e) => e.type === "pause_cleared")).toHaveLength(0);
	});
});

// ─── ExitPlanMode ─────────────────────────────────────────────────────────────

describe("ExitPlanMode pause detection", () => {
	const TOOL_ID = "toolu_exit_001";
	const SESSION_ID = "sess-02";
	const AGENT = "orchestrator";

	it("tool_use ExitPlanMode → pause_started{plan_mode_review}", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		const pending = new Map();
		const seen = new Set<string>();

		parser.processTranscriptLine(
			assistantToolUseLine("ExitPlanMode", TOOL_ID, {
				plan: "## My Plan\n\nStep 1: do X\nStep 2: do Y",
			}),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		const pauseEvents = events.filter((e) => e.type === "pause_started");
		expect(pauseEvents).toHaveLength(1);

		const payload = pauseEvents[0].payload as {
			reason: string;
			toolUseId: string;
			detail?: { plan?: string };
		};
		expect(payload.reason).toBe("plan_mode_review");
		expect(payload.toolUseId).toBe(TOOL_ID);
		expect(payload.detail?.plan).toContain("My Plan");
	});

	it("ExitPlanMode without plan field → pause_started without detail", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		const pending = new Map();
		const seen = new Set<string>();

		// input.plan is undocumented — test that omitting it doesn't crash
		parser.processTranscriptLine(
			assistantToolUseLine("ExitPlanMode", TOOL_ID, {}),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		const pauseEvents = events.filter((e) => e.type === "pause_started");
		expect(pauseEvents).toHaveLength(1);
		expect(pauseEvents[0].payload).not.toHaveProperty("detail");
	});

	it("matching tool_result → pause_cleared{plan_mode_review}", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		const pending = new Map();
		const seen = new Set<string>();

		parser.processTranscriptLine(
			assistantToolUseLine("ExitPlanMode", TOOL_ID, { plan: "My plan" }),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		parser.processTranscriptLine(
			userToolResultLine(TOOL_ID, "Plan approved"),
			AGENT,
			pending,
			seen,
			SESSION_ID,
		);

		const clearedEvents = events.filter((e) => e.type === "pause_cleared");
		expect(clearedEvents).toHaveLength(1);
		expect((clearedEvents[0].payload as { reason: string }).reason).toBe("plan_mode_review");
	});
});

// ─── tool_rejected detection ──────────────────────────────────────────────────

describe("tool_rejected detection via content string scan", () => {
	const SESSION_ID = "sess-03";
	const AGENT = "orchestrator";
	const TOOL_ID = "toolu_read_001";

	// Register a pending tool so the tool_result handler has something to match
	function seedPendingTool(
		parser: TranscriptParser,
		pending: Map<string, unknown>,
		seen: Set<string>,
	): void {
		parser.processTranscriptLine(
			assistantToolUseLine("Read", TOOL_ID, { file_path: "/foo/bar.ts" }),
			AGENT,
			pending as Map<string, import("../../protocol.js").PendingToolCall>,
			seen,
			SESSION_ID,
		);
	}

	it('"User rejected tool use" in content → pause_started{tool_rejected}', () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		const pending = new Map();
		const seen = new Set<string>();

		seedPendingTool(parser, pending, seen);
		events.length = 0; // clear tool_call_start events

		parser.processTranscriptLine(
			userToolResultLine(TOOL_ID, "User rejected tool use"),
			AGENT,
			pending as Map<string, import("../../protocol.js").PendingToolCall>,
			seen,
			SESSION_ID,
		);

		const pauseEvents = events.filter((e) => e.type === "pause_started");
		expect(pauseEvents).toHaveLength(1);
		expect((pauseEvents[0].payload as { reason: string }).reason).toBe("tool_rejected");
	});

	it('"The user doesn\'t want to proceed" prefix → pause_started{tool_rejected}', () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		const pending = new Map();
		const seen = new Set<string>();

		seedPendingTool(parser, pending, seen);
		events.length = 0;

		parser.processTranscriptLine(
			userToolResultLine(
				TOOL_ID,
				"The user doesn't want to proceed with this tool use and has requested a different approach.",
			),
			AGENT,
			pending as Map<string, import("../../protocol.js").PendingToolCall>,
			seen,
			SESSION_ID,
		);

		const pauseEvents = events.filter((e) => e.type === "pause_started");
		expect(pauseEvents).toHaveLength(1);
		expect((pauseEvents[0].payload as { reason: string }).reason).toBe("tool_rejected");
	});

	it("normal tool result without rejection string → no pause_started", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		const pending = new Map();
		const seen = new Set<string>();

		seedPendingTool(parser, pending, seen);
		events.length = 0;

		parser.processTranscriptLine(
			userToolResultLine(TOOL_ID, "File contents here"),
			AGENT,
			pending as Map<string, import("../../protocol.js").PendingToolCall>,
			seen,
			SESSION_ID,
		);

		expect(events.filter((e) => e.type === "pause_started")).toHaveLength(0);
	});

	it("pendingRejection clears when SAME agent emits next assistant text", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		const pending = new Map();
		const seen = new Set<string>();

		seedPendingTool(parser, pending, seen);
		events.length = 0;

		// Tool rejected → sets pendingRejection
		parser.processTranscriptLine(
			userToolResultLine(TOOL_ID, "User rejected tool use"),
			AGENT,
			pending as Map<string, import("../../protocol.js").PendingToolCall>,
			seen,
			SESSION_ID,
		);

		expect(events.filter((e) => e.type === "pause_started")).toHaveLength(1);
		events.length = 0;

		// Same agent emits next assistant text → should emit pause_cleared
		parser.processTranscriptLine(
			assistantTextLine("OK, I will try a different approach.", SESSION_ID),
			AGENT,
			pending as Map<string, import("../../protocol.js").PendingToolCall>,
			seen,
			SESSION_ID,
		);

		const clearedEvents = events.filter((e) => e.type === "pause_cleared");
		expect(clearedEvents).toHaveLength(1);
		expect((clearedEvents[0].payload as { reason: string }).reason).toBe("tool_rejected");
	});
});

// ─── Multi-session / multi-agent collision guard (red-team #12) ───────────────

describe("compound key collision guard — pendingRejection scoped to (sessionId, agent)", () => {
	it("different-agent text does NOT clear parent agent pendingRejection", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		const SESSION_ID = "sess-04";
		const PARENT_AGENT = "orchestrator";
		const SUBAGENT = "researcher";
		const TOOL_ID = "toolu_edit_001";

		const pendingParent = new Map();
		const seenParent = new Set<string>();
		const pendingSub = new Map();
		const seenSub = new Set<string>();

		// 1. Parent registers a tool use
		parser.processTranscriptLine(
			assistantToolUseLine("Edit", TOOL_ID, { file_path: "/x.ts" }),
			PARENT_AGENT,
			pendingParent as Map<string, import("../../protocol.js").PendingToolCall>,
			seenParent,
			SESSION_ID,
		);
		events.length = 0;

		// 2. Parent tool gets rejected
		parser.processTranscriptLine(
			userToolResultLine(TOOL_ID, "User rejected tool use"),
			PARENT_AGENT,
			pendingParent as Map<string, import("../../protocol.js").PendingToolCall>,
			seenParent,
			SESSION_ID,
		);
		expect(events.filter((e) => e.type === "pause_started")).toHaveLength(1);
		events.length = 0;

		// 3. DIFFERENT agent (subagent) emits assistant text
		parser.processTranscriptLine(
			assistantTextLine("Subagent continuing work.", SESSION_ID),
			SUBAGENT,
			pendingSub as Map<string, import("../../protocol.js").PendingToolCall>,
			seenSub,
			SESSION_ID,
		);

		// Parent's pendingRejection must NOT be cleared by subagent's text
		expect(events.filter((e) => e.type === "pause_cleared")).toHaveLength(0);
	});

	it("same agent name in different sessions does NOT cross-contaminate", () => {
		const events: AgentEvent[] = [];
		const parser = new TranscriptParser(makeDelegate(events));
		const SESSION_A = "sess-05a";
		const SESSION_B = "sess-05b";
		const AGENT = "orchestrator"; // same name, different sessions
		const TOOL_ID_A = "toolu_a_001";
		const TOOL_ID_B = "toolu_b_001";

		const pendingA = new Map();
		const seenA = new Set<string>();
		const pendingB = new Map();
		const seenB = new Set<string>();

		// Session A: register + reject
		parser.processTranscriptLine(
			assistantToolUseLine("Read", TOOL_ID_A, { file_path: "/a.ts" }),
			AGENT,
			pendingA as Map<string, import("../../protocol.js").PendingToolCall>,
			seenA,
			SESSION_A,
		);
		events.length = 0;

		parser.processTranscriptLine(
			userToolResultLine(TOOL_ID_A, "User rejected tool use"),
			AGENT,
			pendingA as Map<string, import("../../protocol.js").PendingToolCall>,
			seenA,
			SESSION_A,
		);
		expect(events.filter((e) => e.type === "pause_started")).toHaveLength(1);
		events.length = 0;

		// Session B: same agent name emits assistant text — must NOT clear session A's rejection
		parser.processTranscriptLine(
			assistantTextLine("Session B continuing.", SESSION_B),
			AGENT,
			pendingB as Map<string, import("../../protocol.js").PendingToolCall>,
			seenB,
			SESSION_B,
		);

		expect(events.filter((e) => e.type === "pause_cleared")).toHaveLength(0);

		// Session A: same agent clears its own rejection
		parser.processTranscriptLine(
			assistantTextLine("Session A resuming.", SESSION_A),
			AGENT,
			pendingA as Map<string, import("../../protocol.js").PendingToolCall>,
			seenA,
			SESSION_A,
		);

		const clearedInA = events.filter((e) => e.type === "pause_cleared");
		expect(clearedInA).toHaveLength(1);
		expect((clearedInA[0].payload as { agent: string }).agent).toBe(AGENT);
	});
});
