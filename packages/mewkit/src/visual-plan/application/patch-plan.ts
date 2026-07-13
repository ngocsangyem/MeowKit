/**
 * Patch orchestrator — the single serialized writer behind PATCH /api/visual-plan.
 *
 * Flow: read → optimistic-concurrency check (If-Match ETag) → apply the typed op
 * → bump revision + CLEAR approval → re-validate the mutated plan IN MEMORY →
 * atomic write → return the new ETag. A stale ETag stops before any mutation
 * (409). A patch that would make the artifact invalid/unsafe is rejected and
 * NOT written, so the on-disk artifact is always valid. Approval is cleared on
 * every accepted visual mutation (lane/order/annotation/connector/field) —
 * re-review + re-approve must follow.
 */

import { readArtifactRaw, writeArtifact, artifactPath } from "../infrastructure/visual-plan-repository.js";
import { etagFromFile } from "../../local-web/etag.js";
import { VisualPlanSchema } from "../domain/schemas.js";
import type { PatchOp } from "../domain/patches.js";
import { applyPatchOp } from "./apply-patch-op.js";
import { validateParsed } from "./validate-plan.js";
import { buildVisualBlock, writeVisualBlock } from "../infrastructure/plan-state.js";
import type { ValidationError } from "../domain/errors.js";

export type PatchStatus = "ok" | "stale" | "missing" | "invalid-artifact" | "op-rejected" | "invalid-result";

export interface PatchResult {
	ok: boolean;
	status: PatchStatus;
	revision?: number;
	etag?: string;
	currentEtag?: string;
	message?: string;
	errors?: ValidationError[];
}

/** Apply `op` to the artifact at `planDir` under optimistic concurrency (`ifMatch`). */
export function patchPlan(planDir: string, op: PatchOp, ifMatch?: string): PatchResult {
	const currentEtag = etagFromFile(artifactPath(planDir));
	if (currentEtag === null) return { ok: false, status: "missing" };
	if (ifMatch !== undefined && ifMatch !== currentEtag) return { ok: false, status: "stale", currentEtag };

	const read = readArtifactRaw(planDir);
	if (read.error) return { ok: false, status: "missing" };
	const parsed = VisualPlanSchema.safeParse(read.raw);
	if (!parsed.success) return { ok: false, status: "invalid-artifact" };
	const plan = parsed.data;

	const opError = applyPatchOp(plan, op);
	if (opError) return { ok: false, status: "op-rejected", message: opError };

	// Every accepted visual mutation invalidates approval and advances the revision.
	plan.revision += 1;
	if (plan.review.status === "approved") plan.review.status = "draft";
	plan.review.approvedRevision = null;
	plan.review.approvedAt = null;

	const { errors } = validateParsed(plan, planDir);
	if (errors.length > 0) return { ok: false, status: "invalid-result", errors };

	writeArtifact(planDir, plan);
	writeVisualBlock(planDir, buildVisualBlock(plan, planDir));
	return { ok: true, status: "ok", revision: plan.revision, etag: etagFromFile(artifactPath(planDir)) ?? undefined };
}
