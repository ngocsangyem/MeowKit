/**
 * derivePhaseStatuses regression — covers the dual-pulse bug from
 * 260430-orchviz-redesign-verdict.md §Correctness.
 *
 * Without `active.clear()` in the gate2 block, Plan + Ship both rendered
 * active when gate1 was never approved.
 */

import { describe, expect, it } from "vitest";
import type { PlanData } from "../src/orchviz-web/hooks/use-active-plan";
import { derivePhaseStatuses } from "../src/orchviz-web/lib/phase-status";

const stubPlan: PlanData = {
	slug: "stub",
	title: "Stub",
	status: "draft",
	effort: "m",
	created: "260430",
	path: "/tmp/stub",
	phases: [
		{
			number: 1,
			title: "P1",
			status: "pending",
			effort: "1h",
			todos: [],
			filePath: "/tmp/stub/phase-01.md",
			abandoned: false,
		},
	],
};

function activeIds(states: ReturnType<typeof derivePhaseStatuses>): string[] {
	return states.filter((s) => s.status === "active").map((s) => s.id);
}

describe("derivePhaseStatuses", () => {
	it("plan exists, no gates → Plan active", () => {
		const states = derivePhaseStatuses(stubPlan, { gate1Approved: false, gate2Verdict: null });
		expect(activeIds(states)).toEqual(["plan"]);
	});

	it("gate1 approved → Build active", () => {
		const states = derivePhaseStatuses(stubPlan, { gate1Approved: true, gate2Verdict: null });
		expect(activeIds(states)).toEqual(["build"]);
	});

	it("gate2 PASS clears earlier active markers — Ship is the ONLY active", () => {
		// Regression: without active.clear() in gate2 block, gate1=false + gate2=PASS
		// produced ["plan", "ship"] (dual pulse) — see verdict §Correctness.
		const states = derivePhaseStatuses(stubPlan, { gate1Approved: false, gate2Verdict: "PASS" });
		expect(activeIds(states)).toEqual(["ship"]);
	});

	it("gate2 PASS + gate1 approved → still only Ship active", () => {
		const states = derivePhaseStatuses(stubPlan, { gate1Approved: true, gate2Verdict: "PASS" });
		expect(activeIds(states)).toEqual(["ship"]);
	});

	it("no plan → no active phases", () => {
		const states = derivePhaseStatuses(null, { gate1Approved: false, gate2Verdict: null });
		expect(activeIds(states)).toEqual([]);
	});
});
