/**
 * Validation orchestration — the single deterministic pass Gate 1 depends on.
 *
 * Order: read → schema → cross-refs → coverage → HTML safety → source freshness.
 * Schema failure short-circuits (cross-checks need a well-typed object); every
 * later pass is additive so one artifact can surface many findings at once,
 * each with an exact JSON path and a stable code for agent self-repair.
 */

import { z } from "zod";
import { err, ErrorCode, type ValidationError } from "../domain/errors.js";
import { VisualPlanSchema, type VisualPlan } from "../domain/schemas.js";
import { checkCrossReferences } from "../domain/cross-refs.js";
import { computeCoverage, type CoverageSummary } from "../domain/coverage.js";
import { checkWireframeHtml } from "../infrastructure/wireframe-sanitizer.js";
import { checkSourceFreshness } from "../infrastructure/hashing.js";
import { readArtifactRaw } from "../infrastructure/visual-plan-repository.js";

export interface ValidatePlanResult {
	ok: boolean;
	errors: ValidationError[];
	plan?: VisualPlan;
	coverage?: CoverageSummary;
}

/** Render a Zod issue path (`["canvas","frames",0,"id"]`) as `canvas.frames[0].id`. */
function jsonPath(segments: (string | number)[]): string {
	return segments
		.map((s) => (typeof s === "number" ? `[${s}]` : s))
		.join(".")
		.replace(/\.\[/g, "[");
}

/** Map a Zod error into deterministic `SCHEMA` findings. */
function fromZod(error: z.ZodError): ValidationError[] {
	return error.issues.map((i) => err(jsonPath(i.path) || "<root>", ErrorCode.SCHEMA, i.message));
}

/**
 * Run the deterministic passes on an ALREADY-PARSED plan (cross-refs, coverage,
 * HTML safety, source freshness). Used by `validatePlan` and by the patch
 * pipeline (Phase 5) to re-validate a mutated plan in memory before writing —
 * so a patch can never persist a structurally-invalid or unsafe artifact.
 */
export function validateParsed(
	plan: VisualPlan,
	planDir: string,
): { errors: ValidationError[]; coverage: CoverageSummary } {
	const errors: ValidationError[] = [];
	errors.push(...checkCrossReferences(plan));
	const coverage = computeCoverage(plan);
	errors.push(...coverage.errors);
	plan.canvas.frames.forEach((frame, i) => {
		const check = checkWireframeHtml(frame.wireframe.html);
		if (!check.safe) {
			errors.push(err(`canvas.frames[${i}].wireframe.html`, ErrorCode.UNSAFE_HTML, check.reason ?? "unsafe HTML"));
		}
	});
	errors.push(...checkSourceFreshness(plan, planDir));
	return { errors, coverage: coverage.summary };
}

/** Run every deterministic pass against the artifact in `planDir`. */
export function validatePlan(planDir: string): ValidatePlanResult {
	const read = readArtifactRaw(planDir);
	if (read.error) return { ok: false, errors: [read.error] };

	const parsed = VisualPlanSchema.safeParse(read.raw);
	if (!parsed.success) return { ok: false, errors: fromZod(parsed.error) };
	const plan = parsed.data;

	const { errors, coverage } = validateParsed(plan, planDir);
	return { ok: errors.length === 0, errors, plan, coverage };
}
