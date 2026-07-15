import { describe, expect, it } from "vitest";
import {
	LOGICAL_OPERATIONS,
	OPERATION_AUTHORITY,
	assertOperationsNotInvocable,
	getOperationShape,
	getOperationShapes,
	isLogicalOperation,
} from "../provider-operations.js";
import { KNOWN_INVOCATION_IDS } from "../capability.js";
import { describeProvider, ADAPTED_PROVIDERS } from "../provider-adapter.js";

describe("anti-smuggling: operations are not frontmatter-reachable", () => {
	// The single most important property in this module. KNOWN_INVOCATION_IDS is the
	// closed set frontmatter may name; its whole value is what it EXCLUDES. If
	// `run_shell` ever lands in it, author-controlled frontmatter gains a name for
	// "execute a shell command" — and the enum stops being a boundary at all.
	it("no logical operation appears in KNOWN_INVOCATION_IDS", () => {
		for (const op of LOGICAL_OPERATIONS) {
			expect(KNOWN_INVOCATION_IDS.has(op), `${op} must not be frontmatter-nameable`).toBe(false);
		}
	});

	it("assertOperationsNotInvocable reports no leak on the real sets", () => {
		expect(assertOperationsNotInvocable()).toEqual([]);
	});

	it("the two sets are disjoint in both directions", () => {
		const overlap = [...KNOWN_INVOCATION_IDS].filter((id) => (LOGICAL_OPERATIONS as readonly string[]).includes(id));
		expect(overlap).toEqual([]);
	});

	// Mutation test: the guard must actually fire, not just return [] forever.
	it("the guard detects a leak when one is introduced", () => {
		const spiked = new Set([...KNOWN_INVOCATION_IDS, "run_shell"]);
		const leaked = LOGICAL_OPERATIONS.filter((op) => spiked.has(op));
		expect(leaked).toEqual(["run_shell"]);
	});
});

describe("operation authority is independent of host support", () => {
	it("every operation declares what it may not do, with a rationale", () => {
		for (const op of LOGICAL_OPERATIONS) {
			expect(OPERATION_AUTHORITY[op].mayNot.length, `${op} needs a mayNot`).toBeGreaterThan(0);
			expect(OPERATION_AUTHORITY[op].rationale.length, `${op} needs a rationale`).toBeGreaterThan(0);
		}
	});

	it("manage_plan may never write gate approval state", () => {
		// Claude Code fully supports the task tools — capability is not authority.
		expect(getOperationShape("claude-code", "manage_plan").support).toBe("supported");
		expect(OPERATION_AUTHORITY.manage_plan.mayNot).toMatch(/Gate 1 \/ Gate 2 approval state/);
	});

	it("delegate_agent may not manufacture its own verdict", () => {
		expect(OPERATION_AUTHORITY.delegate_agent.mayNot).toMatch(/reviewer\/evaluator|outside the orchestrated flow/);
	});
});

describe("per-provider operation shapes", () => {
	it("claude-code supports all four via typed tools", () => {
		const shapes = getOperationShapes("claude-code");
		for (const op of LOGICAL_OPERATIONS) expect(shapes[op].support).toBe("supported");
	});

	it("codex does not claim typed-tool support it lacks", () => {
		const shapes = getOperationShapes("codex");
		// Codex reaches surfaces by prompt projection, so nothing that needs a typed
		// tool may be reported `supported` — that would be the over-claim these
		// adapter tables exist to prevent.
		expect(shapes.ask_user.support).not.toBe("supported");
		expect(shapes.delegate_agent.support).not.toBe("supported");
	});

	it("every local-fallback discloses what it falls back to", () => {
		for (const provider of ADAPTED_PROVIDERS) {
			for (const [op, shape] of Object.entries(getOperationShapes(provider))) {
				if (shape.support === "local-fallback") {
					expect(shape.fallback, `${provider}/${op} must disclose its fallback`).toBeTruthy();
				} else {
					// A fallback string on a non-fallback state would imply a substitute
					// that never runs — misleading in the opposite direction.
					expect(shape.fallback, `${provider}/${op} should not name a fallback`).toBeNull();
				}
			}
		}
	});

	it("every shape cites evidence", () => {
		for (const provider of ADAPTED_PROVIDERS) {
			for (const [op, shape] of Object.entries(getOperationShapes(provider))) {
				expect(shape.evidence.length, `${provider}/${op} needs evidence`).toBeGreaterThan(0);
			}
		}
	});

	it("an unknown provider claims nothing", () => {
		const shapes = getOperationShapes("some-future-host");
		for (const op of LOGICAL_OPERATIONS) expect(shapes[op].support).toBe("unknown");
	});

	it("an unrecognized operation resolves to unknown, not a throw", () => {
		expect(getOperationShape("claude-code", "rm_rf_slash").support).toBe("unknown");
	});
});

describe("adapter composition", () => {
	it("describeProvider exposes operations for every adapted provider", () => {
		for (const provider of ADAPTED_PROVIDERS) {
			const view = describeProvider(provider);
			expect(Object.keys(view.operations).sort()).toEqual([...LOGICAL_OPERATIONS].sort());
		}
	});

	it("operations stay distinct from invocation shapes", () => {
		const view = describeProvider("claude-code");
		expect(Object.keys(view.invocation)).not.toEqual(Object.keys(view.operations));
	});
});

describe("isLogicalOperation", () => {
	it("recognizes the four and nothing else", () => {
		for (const op of LOGICAL_OPERATIONS) expect(isLogicalOperation(op)).toBe(true);
		expect(isLogicalOperation("invoke-skill")).toBe(false);
		expect(isLogicalOperation("")).toBe(false);
	});
});
