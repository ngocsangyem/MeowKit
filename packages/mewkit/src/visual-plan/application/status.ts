/**
 * `status` — a read-only summary of the visual artifact's health.
 *
 * Reuses the validation pass so the reported coverage counts and validity are
 * exactly what Gate 1 would see. Never mutates. Absent artifact is reported as
 * `exists:false` (not an error) so `status` is safe to run on any plan dir.
 */

import { validatePlan } from "./validate-plan.js";
import { ErrorCode } from "../domain/errors.js";
import type { CoverageSummary } from "../domain/coverage.js";

export interface PlanStatus {
	exists: boolean;
	valid: boolean;
	revision: number | null;
	reviewStatus: string | null;
	coverage: CoverageSummary | null;
	pendingFeedback: string[];
	errorCount: number;
}

/** Summarize the artifact at `planDir` without mutating anything. */
export function planStatus(planDir: string): PlanStatus {
	const result = validatePlan(planDir);
	const missing = result.errors.some((e) => e.code === ErrorCode.ARTIFACT_MISSING);
	if (missing) {
		return {
			exists: false,
			valid: false,
			revision: null,
			reviewStatus: null,
			coverage: null,
			pendingFeedback: [],
			errorCount: 0,
		};
	}
	return {
		exists: true,
		valid: result.ok,
		revision: result.plan?.revision ?? null,
		reviewStatus: result.plan?.review.status ?? null,
		coverage: result.coverage ?? null,
		pendingFeedback: result.plan?.review.pendingFeedbackBatchIds ?? [],
		errorCount: result.errors.length,
	};
}
