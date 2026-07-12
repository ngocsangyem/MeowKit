/**
 * `approve` — the deterministic post-Gate-1 transition (moved here from Phase 6
 * per red-team C1 so Gate 1 is satisfiable from the first Phase-3 release).
 *
 * The CLI is the SINGLE writer of `review.status`. Approval is refused unless
 * EVERY precondition holds: the artifact fully validates (schema, cross-refs,
 * coverage with `unresolved === 0`, safe HTML, fresh source hashes), there is
 * no pending feedback batch, and the requested `--revision` matches the
 * artifact's current revision (so approval is pinned to the exact reviewed
 * state). On success it stamps `review` and refreshes the `.plan-state` pointer.
 * No skill ever writes an interim approval.
 */

import { validatePlan } from "./validate-plan.js";
import { writeArtifact } from "../infrastructure/visual-plan-repository.js";
import { buildVisualBlock, writeVisualBlock } from "../infrastructure/plan-state.js";
import { nowIso } from "./clock.js";

export interface ApproveResult {
	ok: boolean;
	revision: number;
	/** Human-readable reasons approval was refused; empty on success. */
	failedPreconditions: string[];
}

/**
 * Approve the artifact at `planDir` for exactly `revision`. Returns the refused
 * preconditions instead of throwing, so the CLI can list them and exit non-zero.
 */
export function approvePlan(planDir: string, revision: number): ApproveResult {
	const failed: string[] = [];
	const result = validatePlan(planDir);

	if (!result.ok || !result.plan) {
		for (const e of result.errors) failed.push(`${e.path}: ${e.message} [${e.code}]`);
		return { ok: false, revision, failedPreconditions: failed };
	}
	const plan = result.plan;

	if (plan.revision !== revision) {
		failed.push(`--revision ${revision} does not match artifact revision ${plan.revision}`);
	}
	if (plan.review.pendingFeedbackBatchIds.length > 0) {
		failed.push(`cannot approve with ${plan.review.pendingFeedbackBatchIds.length} pending feedback batch(es)`);
	}
	if (failed.length > 0) return { ok: false, revision, failedPreconditions: failed };

	plan.review.status = "approved";
	plan.review.approvedRevision = revision;
	plan.review.approvedAt = nowIso();
	writeArtifact(planDir, plan);
	writeVisualBlock(planDir, buildVisualBlock(plan, planDir));
	return { ok: true, revision, failedPreconditions: [] };
}
