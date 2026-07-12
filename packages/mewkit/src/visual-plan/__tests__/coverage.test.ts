/**
 * Coverage-closure algorithm: computed summary (never author-trusted), the
 * one-mode invariant, typed-omission requirements, and equivalence-graph cycle
 * / dangling-reference detection.
 */

import { describe, expect, it } from "vitest";
import { computeCoverage } from "../domain/coverage.js";
import { VisualPlanSchema, type VisualPlan } from "../domain/schemas.js";
import { ErrorCode } from "../domain/errors.js";
import { makeValidPlan } from "../__fixtures__/valid-plan.js";

/** Clone the fixture, mutate the plain object, then parse to a typed VisualPlan. */
function planWith(mutate: (p: Record<string, unknown>) => void): VisualPlan {
	const raw = makeValidPlan();
	mutate(raw);
	return VisualPlanSchema.parse(raw);
}

type State = { id: string; frameIds: string[]; sourceRefIds: string[]; omitted?: Record<string, unknown> };
const states = (p: Record<string, unknown>): State[] =>
	((p.uiCoverage as { surfaces: { states: State[] }[] }).surfaces[0].states);

describe("computeCoverage summary (computed, not trusted)", () => {
	it("classifies resolved / planned / omitted with unresolved=0 on the valid fixture", () => {
		const { summary, errors } = computeCoverage(VisualPlanSchema.parse(makeValidPlan()));
		expect(errors).toEqual([]);
		expect(summary).toEqual({ total: 4, resolved: 1, planned: 1, omitted: 2, unresolved: 0 });
	});
});

describe("one-mode closure invariant", () => {
	it("flags a state that closes via neither mode", () => {
		const plan = planWith((p) => {
			states(p)[0].frameIds = [];
		});
		const { errors, summary } = computeCoverage(plan);
		expect(summary.unresolved).toBe(1);
		expect(errors.some((e) => e.code === ErrorCode.COVERAGE_UNRESOLVED)).toBe(true);
	});

	it("flags a state that closes via both modes", () => {
		const plan = planWith((p) => {
			states(p)[0].omitted = { reason: "out-of-scope" };
		});
		expect(computeCoverage(plan).errors.some((e) => e.code === ErrorCode.COVERAGE_UNRESOLVED)).toBe(true);
	});
});

describe("typed omission requirements", () => {
	it("requires a riskId for accepted-risk", () => {
		const plan = planWith((p) => {
			states(p)[2].omitted = { reason: "accepted-risk" };
		});
		expect(computeCoverage(plan).errors.some((e) => e.code === ErrorCode.COVERAGE_MISSING_RISK_ID)).toBe(true);
	});

	it("requires representedBy for equivalent-layout", () => {
		const plan = planWith((p) => {
			states(p)[3].omitted = { reason: "equivalent-layout" };
		});
		expect(computeCoverage(plan).errors.some((e) => e.code === ErrorCode.COVERAGE_MISSING_REPRESENTED_BY)).toBe(true);
	});
});

describe("equivalence graph", () => {
	it("rejects a dangling representedBy target", () => {
		const plan = planWith((p) => {
			states(p)[3].omitted = { reason: "equivalent-layout", representedBy: "st-nope" };
		});
		expect(computeCoverage(plan).errors.some((e) => e.code === ErrorCode.DANGLING_REPRESENTED_BY)).toBe(true);
	});

	it("rejects self-reference", () => {
		const plan = planWith((p) => {
			states(p)[3].omitted = { reason: "equivalent-layout", representedBy: "st-2fa" };
		});
		expect(computeCoverage(plan).errors.some((e) => e.code === ErrorCode.COVERAGE_EQUIVALENCE_CYCLE)).toBe(true);
	});

	it("rejects an equivalence chain that terminates at a frameless (omitted) state", () => {
		const plan = planWith((p) => {
			// st-2fa (equivalent-layout) → st-forgot, which is omitted out-of-scope (no frame)
			states(p)[3].omitted = { reason: "equivalent-layout", representedBy: "st-forgot" };
		});
		expect(computeCoverage(plan).errors.some((e) => e.code === ErrorCode.COVERAGE_EQUIVALENCE_UNBACKED)).toBe(true);
	});

	it("accepts an equivalence chain terminating at a framed state", () => {
		// The valid fixture already does this: st-2fa → st-login-default (framed).
		expect(computeCoverage(VisualPlanSchema.parse(makeValidPlan())).errors).toEqual([]);
	});

	it("rejects a two-node cycle", () => {
		const plan = planWith((p) => {
			const st = states(p);
			st[2].frameIds = [];
			st[2].omitted = { reason: "equivalent-layout", representedBy: "st-2fa" };
			st[3].omitted = { reason: "equivalent-layout", representedBy: "st-forgot" };
		});
		expect(computeCoverage(plan).errors.some((e) => e.code === ErrorCode.COVERAGE_EQUIVALENCE_CYCLE)).toBe(true);
	});
});
