/**
 * Read-only coverage view — recomputes the SAME closure buckets the Node
 * validator reports (`validate --json`), so the panel and the gate never
 * disagree: framed-with-code-evidence → resolved, framed-without → planned,
 * typed omission → omitted, zero/both modes → unresolved. Pure + testable.
 */

import type { VisualPlan, CoverageState } from "../domain/artifact-types.js";

export type StateMode = "resolved" | "planned" | "omitted" | "unresolved";

export interface StateRow {
	surfaceId: string;
	surfaceLabel: string;
	stateId: string;
	stateLabel: string;
	mode: StateMode;
}

export interface CoverageSummary {
	total: number;
	resolved: number;
	planned: number;
	omitted: number;
	unresolved: number;
}

export interface CoverageView {
	summary: CoverageSummary;
	rows: StateRow[];
}

function modeOf(state: CoverageState, codeRefIds: Set<string>): StateMode {
	const framed = state.frameIds.length > 0;
	const omitted = state.omitted !== undefined;
	if (framed === omitted) return "unresolved"; // neither or both
	if (omitted) return "omitted";
	return state.sourceRefIds.some((id) => codeRefIds.has(id)) ? "resolved" : "planned";
}

/** Compute the coverage summary + per-state rows for the panel. */
export function computeCoverageView(plan: VisualPlan): CoverageView {
	const codeRefIds = new Set(plan.sourceRefs.filter((r) => r.kind === "code").map((r) => r.id));
	const summary: CoverageSummary = { total: 0, resolved: 0, planned: 0, omitted: 0, unresolved: 0 };
	const rows: StateRow[] = [];
	for (const surface of plan.uiCoverage.surfaces) {
		for (const state of surface.states) {
			const mode = modeOf(state, codeRefIds);
			summary.total += 1;
			summary[mode] += 1;
			rows.push({
				surfaceId: surface.id,
				surfaceLabel: surface.label ?? surface.id,
				stateId: state.id,
				stateLabel: state.label ?? state.id,
				mode,
			});
		}
	}
	return { summary, rows };
}
