/**
 * `rehash` — the ONLY sanctioned way to refresh pinned source hashes after an
 * intentional Markdown edit (red-team M1).
 *
 * When a human deliberately edits `plan.md`/`phase-*.md`, the artifact's pinned
 * hashes go stale and validation blocks. `rehash` recomputes them from disk and
 * — critically — CLEARS any prior approval (an approval was tied to the old
 * source bytes; refreshing the hash silently would let stale-reviewed content
 * pass Gate 1). It changes nothing else. Re-review + re-`approve` must follow.
 */

import { err, ErrorCode, type ValidationError } from "../domain/errors.js";
import { VisualPlanSchema } from "../domain/schemas.js";
import { computeSourceHashes } from "../infrastructure/hashing.js";
import { readArtifactRaw, writeArtifact } from "../infrastructure/visual-plan-repository.js";
import { buildVisualBlock, writeVisualBlock } from "../infrastructure/plan-state.js";

export interface RehashResult {
	ok: boolean;
	errors: ValidationError[];
	clearedApproval: boolean;
}

/** Recompute `source.planHash`/`phaseHashes` from disk and clear any approval. */
export function rehashPlan(planDir: string): RehashResult {
	const read = readArtifactRaw(planDir);
	if (read.error) return { ok: false, errors: [read.error], clearedApproval: false };

	const parsed = VisualPlanSchema.safeParse(read.raw);
	if (!parsed.success) {
		return {
			ok: false,
			errors: [err("<root>", ErrorCode.SCHEMA, "artifact must be schema-valid before rehash")],
			clearedApproval: false,
		};
	}
	const plan = parsed.data;

	const fresh = computeSourceHashes(planDir, plan.source.planPath);
	plan.source.planHash = fresh.planHash;
	plan.source.phaseHashes = fresh.phaseHashes;

	const clearedApproval = plan.review.status === "approved" || plan.review.approvedRevision !== null;
	if (plan.review.status === "approved" || plan.review.status === "stale") {
		plan.review.status = "draft";
	}
	plan.review.approvedRevision = null;
	plan.review.approvedAt = null;

	writeArtifact(planDir, plan);
	writeVisualBlock(planDir, buildVisualBlock(plan, planDir));
	return { ok: true, errors: [], clearedApproval };
}
