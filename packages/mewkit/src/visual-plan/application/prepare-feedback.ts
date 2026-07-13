/**
 * `prepare-feedback` — freeze the accumulated semantic operations into an
 * immutable `visual-feedback/v1` batch and return the Copy Command.
 *
 * The SERVER is authoritative for the base: `baseRevision` + `baseHash` are
 * stamped from the CURRENT artifact at persist time (not trusted from the
 * client), so a batch always pins the exact reviewed state. The batch is
 * write-once; the Copy Command is a repo-relative `/mk:visual-plan apply-feedback`
 * a fresh agent session can run. Timestamps use the wall clock (this is a normal
 * CLI/server runtime, not a workflow script).
 */

import * as crypto from "node:crypto";
import * as path from "node:path";
import { readArtifactRaw, writeArtifact, serializeArtifact } from "../infrastructure/visual-plan-repository.js";
import { computeEtag } from "../../local-web/etag.js";
import { VisualPlanSchema } from "../domain/schemas.js";
import { FeedbackBatchSchema } from "../domain/feedback-schemas.js";
import { writeBatch } from "../infrastructure/feedback-repository.js";
import { buildVisualBlock, writeVisualBlock } from "../infrastructure/plan-state.js";

export interface PrepareResult {
	ok: boolean;
	batchId?: string;
	copyCommand?: string;
	error?: string;
}

/** Compact `YYYYMMDDHHMMSS` timestamp (≥8 digits, satisfies the batch-id pattern). */
function stamp(): string {
	const d = new Date();
	const p = (n: number, w = 2): string => String(n).padStart(w, "0");
	return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Build + persist an immutable feedback batch from `operations`. Returns the
 * batch id + Copy Command, or an error (empty/invalid operations, missing
 * artifact, id collision).
 */
export function prepareFeedback(planDir: string, operations: unknown[]): PrepareResult {
	const read = readArtifactRaw(planDir);
	if (read.error) return { ok: false, error: "no visual artifact to attach feedback to" };
	const parsed = VisualPlanSchema.safeParse(read.raw);
	if (!parsed.success) return { ok: false, error: "artifact must be schema-valid before preparing feedback" };
	const plan = parsed.data;

	// Validate the operations BEFORE mutating the artifact (build a throwaway batch
	// with a placeholder hash just to run the op schema).
	const id = `feedback-${stamp()}-${crypto.randomBytes(4).toString("hex")}`;
	const opCheck = FeedbackBatchSchema.safeParse({
		schemaVersion: "visual-feedback/v1", id, planId: plan.id, baseRevision: plan.revision,
		baseHash: "0".repeat(64), createdAt: new Date().toISOString(), operations, status: "open",
	});
	if (!opCheck.success) return { ok: false, error: `invalid feedback operations: ${opCheck.error.issues[0]?.message ?? "schema"}` };

	// Transition review → feedback-pending: outstanding feedback makes the current
	// approval stale and BLOCKS approve (the "no pending feedback batch" gate).
	// NOTE: this is effectively single-active-batch — baseHash covers the whole
	// artifact incl. the pending list, so preparing/resolving another batch marks
	// earlier open batches stale (fails safe: checkBatchFresh → STOP, never corrupt).
	plan.review.pendingFeedbackBatchIds = [...new Set([...plan.review.pendingFeedbackBatchIds, id])];
	plan.review.status = "feedback-pending";
	plan.review.approvedRevision = null;
	plan.review.approvedAt = null;

	// Write the batch BEFORE mutating the artifact, using the EXACT bytes the
	// artifact write will persist (byte-identical serialization). A crash between
	// the two writes then leaves at worst an inert STALE batch (recoverable), never
	// a stranded pending id with no batch (which would permanently block approve).
	const bytes = serializeArtifact(plan);
	const batch = FeedbackBatchSchema.safeParse({ ...opCheck.data, baseHash: computeEtag(bytes) });
	if (!batch.success || !writeBatch(planDir, batch.data)) return { ok: false, error: `could not persist batch ${id}` };
	writeArtifact(planDir, plan);
	writeVisualBlock(planDir, buildVisualBlock(plan, planDir));

	const rel = path.relative(process.cwd(), planDir) || ".";
	return { ok: true, batchId: id, copyCommand: `/mk:visual-plan apply-feedback ${rel} --batch ${id}` };
}
