/**
 * Canonical 7-phase workflow status derivation.
 *
 * Per red-team H5 (orchviz redesign): TopStrip shows the canonical 7-phase
 * MeowKit model (Orient · Plan · Test · Build · Review · Ship · Reflect),
 * NOT the project-specific plan phases (1-N). Sub-phases (Simplify, Verify)
 * collapse into "Build".
 *
 * Per red-team H6: trust per-phase explicit status from /api/plan; multiple
 * phases may be active concurrently.
 *
 * Project-plan phases don't map 1:1 to canonical phases — the visual model is
 * "where is the workflow likely at right now". v1.1 derives a simple heuristic
 * from gate state. Active-phase detection improves in v1.2.
 */

import type { PlanData } from "@/hooks/use-active-plan";

export type CanonicalPhaseId =
	| "orient"
	| "plan"
	| "test"
	| "build"
	| "review"
	| "ship"
	| "reflect";

export const CANONICAL_PHASES: ReadonlyArray<{ id: CanonicalPhaseId; label: string }> = [
	{ id: "orient", label: "Orient" },
	{ id: "plan", label: "Plan" },
	{ id: "test", label: "Test" },
	{ id: "build", label: "Build" },
	{ id: "review", label: "Review" },
	{ id: "ship", label: "Ship" },
	{ id: "reflect", label: "Reflect" },
];

export type CanonicalStatus = "completed" | "active" | "pending";

export interface CanonicalPhaseState {
	id: CanonicalPhaseId;
	label: string;
	status: CanonicalStatus;
}

export interface GateContext {
	gate1Approved: boolean;
	gate2Verdict: "PASS" | "WARN" | "FAIL" | null;
}

/**
 * Derive canonical phase statuses from plan + gate context.
 * Heuristic: gates establish lower-bound completion; project-plan in_progress
 * lights "build" by default (most plans are in build phase when active).
 */
export function derivePhaseStatuses(
	plan: PlanData | null,
	gates: GateContext,
): CanonicalPhaseState[] {
	const completed = new Set<CanonicalPhaseId>();
	const active = new Set<CanonicalPhaseId>();

	if (plan) {
		// If a plan exists at all, Orient is done.
		completed.add("orient");
		// If gate1 approved, Plan is done.
		if (gates.gate1Approved) completed.add("plan");

		// Check project-phase statuses to detect activity.
		const anyActive = plan.phases.some(
			(p) => p.status === "active" || p.status === "in_progress",
		);
		const anyCompleted = plan.phases.some((p) => p.status === "completed");

		if (gates.gate1Approved && anyActive) {
			// Plans typically iterate Test → Build → Review during build phase.
			active.add("build");
		} else if (gates.gate1Approved) {
			// Plan approved but nothing active — between phases.
			active.add("build");
		} else if (plan && !gates.gate1Approved) {
			// Plan exists but Gate 1 not approved → still in Plan phase.
			active.add("plan");
		}

		if (anyCompleted && !anyActive && gates.gate1Approved) {
			completed.add("test");
			completed.add("build");
		}
	}

	if (gates.gate2Verdict) {
		completed.add("orient");
		completed.add("plan");
		completed.add("test");
		completed.add("build");
		completed.add("review");
		// Clear all earlier active markers — once Gate 2 has a verdict, the workflow
		// has moved to Ship regardless of gate1 state. Without clear() and gate1 was
		// never approved (cross-session state), "plan" stayed active producing a
		// dual-pulse render. (reviewer 260430-orchviz-redesign-verdict.md §Correctness)
		active.clear();
		active.add("ship");
	}

	return CANONICAL_PHASES.map(({ id, label }) => {
		let status: CanonicalStatus = "pending";
		if (completed.has(id)) status = "completed";
		if (active.has(id)) status = "active";
		return { id, label, status };
	});
}
