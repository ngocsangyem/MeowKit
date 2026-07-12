/**
 * Deterministic coverage-closure algorithm.
 *
 * Every `uiCoverage.surfaces[*].states[*]` MUST close via exactly one mode:
 *   - framed   — non-empty `frameIds`
 *   - omitted  — a typed `omitted` block (equivalent-layout needs a valid
 *                `representedBy`; accepted-risk needs a `riskId`)
 * Zero modes OR both modes ⇒ unresolved (a hard gate: `unresolved > 0` blocks
 * Gate 1). Framed states are further split into `resolved` (backed by ≥1 code
 * source ref — existing UI proven in code) and `planned` (framed net-new UI
 * with no code evidence yet).
 *
 * The summary is COMPUTED here and never trusted from the author (red-team M6:
 * the validator guarantees "no structurally-unaccounted state"; whether a
 * `planned`/`omitted` tag is HONEST is the Step-5 red-team's job, not this).
 *
 * `representedBy` forms an equivalence graph; cycles and self-reference are
 * rejected (the chain must terminate, it cannot close by pointing in a loop).
 */

import { err, ErrorCode, type ValidationError } from "./errors.js";
import type { CoverageState, VisualPlan } from "./schemas.js";

export interface CoverageSummary {
	total: number;
	resolved: number;
	planned: number;
	omitted: number;
	unresolved: number;
}

export interface CoverageResult {
	summary: CoverageSummary;
	errors: ValidationError[];
}

type Mode = "framed" | "omitted" | "unresolved";

/** Which closure mode a state uses, or `unresolved` for zero/both. */
function closureMode(state: CoverageState): Mode {
	const framed = state.frameIds.length > 0;
	const omitted = state.omitted !== undefined;
	if (framed === omitted) return "unresolved"; // neither or both
	return framed ? "framed" : "omitted";
}

/** A framed state is `resolved` if any of its source refs is code-backed, else `planned`. */
function framedBucket(state: CoverageState, codeRefIds: Set<string>): "resolved" | "planned" {
	return state.sourceRefIds.some((id) => codeRefIds.has(id)) ? "resolved" : "planned";
}

/**
 * Walk the `representedBy` chain from an equivalent-layout omission. The chain
 * MUST resolve, be acyclic/non-self-referential, AND terminate at a framed
 * state — a state is only "covered by equivalence" if the layout it claims to
 * equal is actually rendered somewhere. Terminating at a frameless state (an
 * omission of any kind) defeats the closure guarantee and is rejected. Emits at
 * most one error per starting state.
 */
function checkEquivalence(
	stateId: string,
	byId: Map<string, CoverageState>,
	path: string,
	errors: ValidationError[],
): void {
	const visited = new Set<string>([stateId]);
	let current = byId.get(stateId);
	while (current?.omitted?.reason === "equivalent-layout") {
		const target = current.omitted.representedBy;
		if (target === undefined) {
			errors.push(err(`${path}.omitted`, ErrorCode.COVERAGE_MISSING_REPRESENTED_BY, "equivalent-layout omission requires representedBy"));
			return;
		}
		if (!byId.has(target)) {
			errors.push(err(`${path}.omitted.representedBy`, ErrorCode.DANGLING_REPRESENTED_BY, `references unknown coverage state "${target}"`));
			return;
		}
		if (visited.has(target)) {
			errors.push(err(`${path}.omitted.representedBy`, ErrorCode.COVERAGE_EQUIVALENCE_CYCLE, `equivalence cycle through "${target}"`));
			return;
		}
		visited.add(target);
		current = byId.get(target);
	}
	// Terminal reached (a non-equivalent-layout state). It must render a frame.
	if (current === undefined || current.frameIds.length === 0) {
		errors.push(err(`${path}.omitted.representedBy`, ErrorCode.COVERAGE_EQUIVALENCE_UNBACKED, "equivalent-layout chain must terminate at a framed state (it resolves to no rendered layout)"));
	}
}

/** Compute the coverage summary and every closure error for the whole artifact. */
export function computeCoverage(plan: VisualPlan): CoverageResult {
	const errors: ValidationError[] = [];
	const summary: CoverageSummary = { total: 0, resolved: 0, planned: 0, omitted: 0, unresolved: 0 };
	const codeRefIds = new Set(plan.sourceRefs.filter((r) => r.kind === "code").map((r) => r.id));
	const byId = new Map<string, CoverageState>();
	for (const s of plan.uiCoverage.surfaces) for (const st of s.states) byId.set(st.id, st);

	plan.uiCoverage.surfaces.forEach((surface, si) =>
		surface.states.forEach((state, ti) => {
			summary.total += 1;
			const path = `uiCoverage.surfaces[${si}].states[${ti}]`;
			const mode = closureMode(state);
			if (mode === "unresolved") {
				summary.unresolved += 1;
				errors.push(err(path, ErrorCode.COVERAGE_UNRESOLVED, "state closes via zero or multiple modes (need exactly one of frameIds / omitted)"));
				return;
			}
			if (mode === "framed") {
				summary[framedBucket(state, codeRefIds)] += 1;
				return;
			}
			// omitted
			summary.omitted += 1;
			const o = state.omitted!;
			if (o.reason === "accepted-risk" && (o.riskId === undefined || o.riskId.length === 0)) {
				errors.push(err(`${path}.omitted`, ErrorCode.COVERAGE_MISSING_RISK_ID, "accepted-risk omission requires a riskId"));
			}
			if (o.reason === "equivalent-layout") checkEquivalence(state.id, byId, path, errors);
		}),
	);
	return { summary, errors };
}
