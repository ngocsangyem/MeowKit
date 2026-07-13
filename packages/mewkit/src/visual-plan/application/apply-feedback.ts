/**
 * Apply-feedback CLI mechanics (deterministic half of the Phase-6 loop).
 *
 * The AGENT (the mk:visual-plan skill) classifies + applies each operation
 * (visual-only → CLI patch; plan-semantic → Markdown edit; implementation →
 * deferred; ambiguous → ask). This module owns only the deterministic guards:
 *   - `checkBatchFresh` — STOP before ANY mutation if the batch's baseRevision/
 *     baseHash no longer match the artifact (no auto-merge onto drifted state).
 *   - `recordResolution` — write the per-op receipt write-once (refuse a second
 *     apply of the same batch). Receipt existence is the "resolved" marker.
 */

import { readArtifactRaw, artifactPath, writeArtifact } from "../infrastructure/visual-plan-repository.js";
import { etagFromFile } from "../../local-web/etag.js";
import { VisualPlanSchema } from "../domain/schemas.js";
import { ResolutionReceiptSchema } from "../domain/feedback-schemas.js";
import { readBatch } from "../infrastructure/feedback-repository.js";
import { receiptExists, writeReceipt } from "../infrastructure/receipt-repository.js";
import { buildVisualBlock, writeVisualBlock } from "../infrastructure/plan-state.js";
import { isValidFeedbackBatchId } from "../domain/ids.js";
import { nowIso } from "./clock.js";

export interface FreshnessResult {
	ok: boolean;
	stale?: boolean;
	reason?: string;
}

/** Verify the batch still applies to the CURRENT artifact (pre-apply gate). */
export function checkBatchFresh(planDir: string, batchId: string): FreshnessResult {
	if (!isValidFeedbackBatchId(batchId)) return { ok: false, reason: `invalid batch id: ${JSON.stringify(batchId)}` };
	const batch = readBatch(planDir, batchId);
	if (!batch) return { ok: false, reason: `batch ${batchId} not found or invalid` };
	if (receiptExists(planDir, batchId)) return { ok: false, reason: `batch ${batchId} already resolved` };
	const read = readArtifactRaw(planDir);
	if (read.error) return { ok: false, reason: "no visual artifact" };
	const parsed = VisualPlanSchema.safeParse(read.raw);
	if (!parsed.success) return { ok: false, reason: "artifact not schema-valid" };
	const currentHash = etagFromFile(artifactPath(planDir));
	if (batch.baseRevision !== parsed.data.revision || batch.baseHash !== currentHash) {
		return { ok: false, stale: true, reason: `batch base (rev ${batch.baseRevision}) no longer matches artifact (rev ${parsed.data.revision}) — regenerate feedback` };
	}
	return { ok: true };
}

export interface RecordResult {
	ok: boolean;
	receiptPath?: string;
	reopenCommand?: string;
	error?: string;
}

/**
 * Write the resolution receipt (agent supplies per-op outcomes). Refuses a
 * double-apply. `resolvedAtRevision` is the artifact's CURRENT revision (after
 * the agent applied ops). Returns the reopen command for re-review.
 */
export function recordResolution(planDir: string, batchId: string, entries: unknown): RecordResult {
	if (!isValidFeedbackBatchId(batchId)) return { ok: false, error: `invalid batch id: ${JSON.stringify(batchId)}` };
	const batch = readBatch(planDir, batchId);
	if (!batch) return { ok: false, error: `batch ${batchId} not found or invalid` };
	if (receiptExists(planDir, batchId)) return { ok: false, error: `batch ${batchId} already resolved (receipt exists)` };
	const read = readArtifactRaw(planDir);
	if (read.error) return { ok: false, error: "no visual artifact" };
	const parsed = VisualPlanSchema.safeParse(read.raw);
	if (!parsed.success) return { ok: false, error: "artifact not schema-valid" };

	const receipt = ResolutionReceiptSchema.safeParse({
		schemaVersion: "visual-feedback-receipt/v1",
		batchId,
		planId: parsed.data.id,
		baseRevision: batch.baseRevision,
		resolvedAtRevision: parsed.data.revision,
		resolvedAt: nowIso(),
		entries,
	});
	if (!receipt.success) return { ok: false, error: `invalid receipt entries: ${receipt.error.issues[0]?.message ?? "schema"}` };
	if (!writeReceipt(planDir, receipt.data)) return { ok: false, error: `receipt for ${batchId} already exists` };

	// Clear the batch from the pending list (it is now resolved). When none remain,
	// drop review back to `draft` so the plan is eligible for re-review + approve.
	const plan = parsed.data;
	plan.review.pendingFeedbackBatchIds = plan.review.pendingFeedbackBatchIds.filter((x) => x !== batchId);
	if (plan.review.pendingFeedbackBatchIds.length === 0 && plan.review.status === "feedback-pending") {
		plan.review.status = "draft";
	}
	writeArtifact(planDir, plan);
	writeVisualBlock(planDir, buildVisualBlock(plan, planDir));

	return { ok: true, receiptPath: `visual-plan/resolutions/${batchId}.json`, reopenCommand: `mewkit visual-plan edit ${planDir}` };
}
