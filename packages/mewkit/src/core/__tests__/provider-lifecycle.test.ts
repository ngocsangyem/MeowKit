// Phase 6 slice 1: per-provider lifecycle-event mappings. The load-bearing invariants: no event
// claims a `gate` (deny/block) without a runtime-hook proof, and the codex map does not drift from
// the authoritative migrate capability table.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	LIFECYCLE_EVENTS,
	getLifecycleMap,
	gatingEvents,
	enforcementGaps,
	gateProofViolations,
	gateProofViolationsInMap,
	SECURITY_ENFORCEMENT_EVENTS,
	type LifecycleEvent,
	type LifecycleMap,
} from "../provider-lifecycle.js";
import { CODEX_SUPPORTED_EVENTS } from "../../migrate/providers/codex/capabilities.js";

// Repo root = five segments up from this file (packages/mewkit/src/core/__tests__ → repo).
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const ALL_LIFECYCLE_PROVIDERS = ["claude-code", "claude-plugin", "codex", "some-future-runtime"];

describe("getLifecycleMap", () => {
	it("claude-code: all 9 events supported; gate ONLY on pre_tool / stop (prompt_submitted has no in-repo blocker)", () => {
		const m = getLifecycleMap("claude-code");
		for (const e of LIFECYCLE_EVENTS) expect(m[e].status, e).toBe("supported");
		expect(gatingEvents("claude-code").sort()).toEqual(["pre_tool", "stop"].sort());
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
	it("claude-code gaps ONLY on prompt_submitted (no shipped UserPromptSubmit blocker); pre_tool + stop enforce", () => {
		const gaps = enforcementGaps("claude-code");
		expect(gaps.map((g) => g.event)).toEqual(["prompt_submitted"]);
		expect(gaps[0].reason).toMatch(/block/i);
	});

	it("codex has a gap on EVERY safety deny event (version-gated, not statically guaranteed)", () => {
		const gaps = enforcementGaps("codex")
			.map((g) => g.event)
			.sort();
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

describe("enforced-without-proof invariant — no gate:true without a real artifact", () => {
	it("gateProofViolations is empty: every gate:true declares a proof", () => {
		expect(gateProofViolations(ALL_LIFECYCLE_PROVIDERS)).toEqual([]);
	});

	it("every gate:true proof references a file that EXISTS and cites a deny/block artifact", () => {
		for (const provider of ALL_LIFECYCLE_PROVIDERS) {
			const m = getLifecycleMap(provider);
			for (const e of LIFECYCLE_EVENTS) {
				if (!m[e].gate) continue;
				const proof = m[e].proof;
				expect(proof, `${provider}.${e} gate:true must declare a proof`).toBeTruthy();
				const proofPath = resolve(REPO_ROOT, (proof as string).split("#")[0]);
				const contents = readFileSync(proofPath, "utf8"); // throws if the artifact does not exist
				expect(/deny|block|exit 2/i.test(contents), `${provider}.${e} proof must exercise a deny/block: ${proof}`).toBe(
					true,
				);
			}
		}
	});

	it("the real guard catches a gate:true that lacks a proof (exercises gateProofViolationsInMap)", () => {
		// A forged map standing in for a future edit that flips an event to gate:true without evidence.
		const forged = { ...getLifecycleMap("codex") } as LifecycleMap;
		forged.pre_tool = { status: "supported", gate: true, evidence: "forged — no proof declared" };
		const violations = gateProofViolationsInMap("forged", forged);
		expect(violations.map((v) => v.event)).toEqual(["pre_tool"]);
		// And a proof-bearing gate does NOT trip it.
		forged.pre_tool = {
			status: "supported",
			gate: true,
			evidence: "ok",
			proof: "src/__tests__/hooks/gate-enforcement.integration.test.ts",
		};
		expect(gateProofViolationsInMap("forged", forged)).toEqual([]);
	});
});
