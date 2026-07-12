// Phase 6 slice 1: per-provider lifecycle-event mappings. The load-bearing invariants: no event
// claims a `gate` (deny/block) without a runtime-hook proof, and the codex map does not drift from
// the authoritative migrate capability table.
import { describe, expect, it } from "vitest";
import { LIFECYCLE_EVENTS, getLifecycleMap, gatingEvents, enforcementGaps, SECURITY_ENFORCEMENT_EVENTS, type LifecycleEvent } from "../provider-lifecycle.js";
import { CODEX_SUPPORTED_EVENTS } from "../../migrate/providers/codex/capabilities.js";

describe("getLifecycleMap", () => {
	it("claude-code: all 9 events supported; gate ONLY on pre_tool / prompt_submitted / stop", () => {
		const m = getLifecycleMap("claude-code");
		for (const e of LIFECYCLE_EVENTS) expect(m[e].status, e).toBe("supported");
		expect(gatingEvents("claude-code").sort()).toEqual(["pre_tool", "prompt_submitted", "stop"].sort());
	});

	it("claude-plugin mirrors claude-code (same hooks, propagated by build-plugin)", () => {
		const plugin = getLifecycleMap("claude-plugin");
		for (const e of LIFECYCLE_EVENTS) {
			expect(plugin[e].status, e).toBe("supported");
			expect(plugin[e].gate, e).toBe(getLifecycleMap("claude-code")[e].gate);
		}
	});

	it("codex: tool_failure unsupported, others supported/advisory, and NO proven gate (version-gated)", () => {
		const m = getLifecycleMap("codex");
		expect(m.tool_failure.status).toBe("unsupported");
		expect(m.pre_tool.status).toBe("advisory"); // deny is real but version-gated ⇒ not enforceable statically
		expect(gatingEvents("codex")).toEqual([]); // honors "no enforceable without runtime proof"
	});

	it("unknown provider: every event unknown, nothing gated (claims nothing)", () => {
		const m = getLifecycleMap("some-future-runtime");
		for (const e of LIFECYCLE_EVENTS) {
			expect(m[e].status, e).toBe("unknown");
			expect(m[e].gate, e).toBe(false);
		}
		expect(gatingEvents("some-future-runtime")).toEqual([]);
	});
});

describe("enforceable invariant — no gate without proof", () => {
	it("every gate:true event is `supported` and cites a real deny/block mechanism", () => {
		for (const provider of ["claude-code", "claude-plugin", "codex", "some-future-runtime"]) {
			const m = getLifecycleMap(provider);
			for (const e of LIFECYCLE_EVENTS) {
				if (!m[e].gate) continue;
				expect(m[e].status, `${provider}.${e}`).toBe("supported"); // never advisory/unknown/unsupported
				expect(m[e].evidence, `${provider}.${e}`).toMatch(/deny|block|exit 2/i);
			}
		}
	});
});

describe("enforcementGaps — honest security/privacy enforcement signal", () => {
	it("claude-code has NO gaps (all safety deny events can block)", () => {
		expect(enforcementGaps("claude-code")).toEqual([]);
	});

	it("codex has a gap on EVERY safety deny event (version-gated, not statically guaranteed)", () => {
		const gaps = enforcementGaps("codex").map((g) => g.event).sort();
		expect(gaps).toEqual([...SECURITY_ENFORCEMENT_EVENTS].sort());
		expect(enforcementGaps("codex")[0].reason).toBeTruthy();
	});

	it("an unknown provider gaps on all safety events with an 'unproven' reason", () => {
		const gaps = enforcementGaps("some-future-runtime");
		expect(gaps.map((g) => g.event).sort()).toEqual([...SECURITY_ENFORCEMENT_EVENTS].sort());
		expect(gaps.every((g) => g.status === "unknown")).toBe(true);
	});
});

describe("codex drift guard — agrees with the authoritative capability table", () => {
	// Logical lifecycle event → codex hook event name (the portable↔native mapping).
	const CODEX_EVENT_NAME: Partial<Record<LifecycleEvent, string>> = {
		session_start: "SessionStart",
		pre_tool: "PreToolUse",
		post_tool: "PostToolUse",
		prompt_submitted: "UserPromptSubmit",
		stop: "Stop",
		pre_compaction: "PreCompact",
		subagent_start: "SubagentStart",
		subagent_stop: "SubagentStop",
	};

	it("every non-unsupported codex event maps to a member of CODEX_SUPPORTED_EVENTS", () => {
		const m = getLifecycleMap("codex");
		for (const e of LIFECYCLE_EVENTS) {
			if (m[e].status === "unsupported") {
				expect(CODEX_EVENT_NAME[e], `${e} should have no codex mapping`).toBeUndefined();
				continue;
			}
			const native = CODEX_EVENT_NAME[e];
			expect(native, e).toBeDefined();
			expect(CODEX_SUPPORTED_EVENTS.has(native as string), `${e}→${native}`).toBe(true);
		}
	});
});
