/**
 * `visual-feedback/v1` immutable batch schema + resolution-receipt schema.
 *
 * A feedback batch is written once and never mutated (red-team: immutability is
 * the misapplication guard). It captures the reviewer's intent against an exact
 * `baseRevision` + `baseHash`; the apply loop (Phase 6) refuses to apply a batch
 * whose base no longer matches the artifact. The batch `id` is charset-locked so
 * a consumer can validate it BEFORE any path join.
 *
 * The resolution receipt mirrors the batch, recording a per-operation outcome
 * (`applied | rejected | unresolved`). Batches remain byte-immutable after
 * resolution; the receipt is the mutable-outcome surface.
 *
 * `markup` operation points are position-absolute / unanchored (red-team L3):
 * they do NOT track frames across layout regeneration — documented, not a bug.
 */

import { z } from "zod";
import { ENTITY_ID_RE, FEEDBACK_BATCH_ID_RE } from "./ids.js";

const EntityId = z.string().regex(ENTITY_ID_RE);
const BatchId = z.string().regex(FEEDBACK_BATCH_ID_RE, "invalid feedback batch id (path-injection guard)");

export const FEEDBACK_OP_TYPES = [
	"annotation",
	"copy-change",
	"field-change",
	"flow-change",
	"scope-change",
	"other",
] as const;

const FeedbackOperationSchema = z
	.object({
		type: z.enum(FEEDBACK_OP_TYPES),
		frameId: EntityId.optional(),
		elementId: z.string().optional(),
		sourceRefId: EntityId.optional(),
		visualPoint: z.object({ x: z.number(), y: z.number() }).strict().optional(),
		intent: z.string().min(1),
		comment: z.string().optional(),
		context: z.string().optional(),
	})
	.strict();

export const FeedbackBatchSchema = z
	.object({
		schemaVersion: z.literal("visual-feedback/v1"),
		id: BatchId,
		planId: EntityId,
		baseRevision: z.number().int().nonnegative(),
		baseHash: z.string().min(1),
		createdAt: z.string().min(1),
		operations: z.array(FeedbackOperationSchema).min(1).max(500),
		status: z.enum(["open", "resolved"]).default("open"),
	})
	.strict();

export type FeedbackBatch = z.infer<typeof FeedbackBatchSchema>;

const ResolutionEntrySchema = z
	.object({
		index: z.number().int().nonnegative(),
		outcome: z.enum(["applied", "rejected", "unresolved"]),
		notes: z.string().optional(),
	})
	.strict();

export const ResolutionReceiptSchema = z
	.object({
		schemaVersion: z.literal("visual-feedback-receipt/v1"),
		batchId: BatchId,
		planId: EntityId,
		baseRevision: z.number().int().nonnegative(),
		resolvedAtRevision: z.number().int().nonnegative(),
		resolvedAt: z.string().min(1),
		entries: z.array(ResolutionEntrySchema),
	})
	.strict();

export type ResolutionReceipt = z.infer<typeof ResolutionReceiptSchema>;
