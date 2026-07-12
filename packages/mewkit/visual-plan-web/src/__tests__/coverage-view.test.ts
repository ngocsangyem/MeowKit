/**
 * Coverage view buckets must match the Node validator's computed summary (so the
 * panel and Gate 1 agree). Uses the shared Phase-1 fixture.
 */

import { describe, expect, it } from "vitest";
import { computeCoverageView } from "../app/coverage-view.js";
import { makeValidPlan } from "../../../src/visual-plan/__fixtures__/valid-plan.js";
import type { VisualPlan } from "../domain/artifact-types.js";

const plan = (): VisualPlan => makeValidPlan() as unknown as VisualPlan;

describe("computeCoverageView", () => {
	it("matches the validator buckets on the valid fixture", () => {
		const { summary } = computeCoverageView(plan());
		// Same shape the Node coverage.test.ts asserts: 4 states, 1 resolved, 1 planned, 2 omitted.
		expect(summary).toEqual({ total: 4, resolved: 1, planned: 1, omitted: 2, unresolved: 0 });
	});

	it("counts a state closing via no mode as unresolved", () => {
		const p = plan();
		p.uiCoverage.surfaces[0].states[0].frameIds = [];
		const { summary } = computeCoverageView(p);
		expect(summary.unresolved).toBe(1);
	});
});
