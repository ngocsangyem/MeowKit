/**
 * `visual-plan/v1` canonical artifact schema (shape + bounded sizes only).
 *
 * This module validates STRUCTURE. Cross-reference integrity (dangling refs,
 * duplicate ids), coverage closure, HTML safety, and source-hash freshness are
 * separate deterministic passes (`cross-refs.ts`, `coverage.ts`, the sanitizer,
 * `hashing.ts`) so each can emit an exact JSON path and a stable code.
 *
 * `.passthrough()` is used on the top-level object so a future additive field
 * survives a read→write round-trip; every nested object stays strict.
 *
 * Bounds (red-team: agent-native precedent caps depth/count/size) protect the
 * validator and the Phase-4 renderer from pathological artifacts.
 */

import { z } from "zod";
import { ENTITY_ID_RE } from "./ids.js";

/** Concrete caps. Generous for real plans, hard ceilings against abuse. */
export const CAPS = {
	FRAMES: 200,
	CONNECTORS: 400,
	ANNOTATIONS: 200,
	LANES: 40,
	DOCUMENT_BLOCKS: 100,
	SURFACES: 50,
	STATES_PER_SURFACE: 100,
	SOURCE_REFS: 500,
	HTML_BYTES: 20_000,
} as const;

const EntityId = z.string().regex(ENTITY_ID_RE, "invalid id (charset [A-Za-z0-9_-], max 128)");

export const SURFACE_KINDS = ["browser", "desktop", "mobile", "popover", "panel", "dialog"] as const;
export const CHANGE_MODES = ["current", "target", "unchanged-context"] as const;
export const OMISSION_REASONS = [
	"equivalent-layout",
	"out-of-scope",
	"unreachable-after-change",
	"non-visual-only",
	"requires-runtime-data",
	"accepted-risk",
] as const;
export const REVIEW_STATUSES = ["draft", "feedback-pending", "approved", "stale"] as const;

const SourceRefSchema = z
	.object({
		id: EntityId,
		kind: z.enum(["code", "plan-requirement"]),
		ref: z.string().min(1),
		note: z.string().optional(),
	})
	.strict();

const OmissionSchema = z
	.object({
		reason: z.enum(OMISSION_REASONS),
		representedBy: EntityId.optional(),
		riskId: z.string().min(1).optional(),
		note: z.string().optional(),
	})
	.strict();

const CoverageStateSchema = z
	.object({
		id: EntityId,
		label: z.string().optional(),
		frameIds: z.array(EntityId).max(CAPS.FRAMES).default([]),
		sourceRefIds: z.array(EntityId).max(CAPS.SOURCE_REFS).default([]),
		omitted: OmissionSchema.optional(),
	})
	.strict();

const CoverageSurfaceSchema = z
	.object({
		id: EntityId,
		label: z.string().optional(),
		states: z.array(CoverageStateSchema).max(CAPS.STATES_PER_SURFACE),
	})
	.strict();

const CoverageSummarySchema = z
	.object({
		total: z.number().int().nonnegative(),
		resolved: z.number().int().nonnegative(),
		planned: z.number().int().nonnegative(),
		omitted: z.number().int().nonnegative(),
		unresolved: z.number().int().nonnegative(),
	})
	.strict();

const UiCoverageSchema = z
	.object({
		surfaces: z.array(CoverageSurfaceSchema).max(CAPS.SURFACES),
		/** Author totals are IGNORED — always recomputed from states. Optional here. */
		summary: CoverageSummarySchema.optional(),
	})
	.strict();

const WireframeSchema = z
	.object({
		format: z.literal("semantic-html"),
		html: z.string().max(CAPS.HTML_BYTES, `wireframe HTML exceeds ${CAPS.HTML_BYTES} bytes`),
	})
	.strict();

const LaneSchema = z
	.object({ id: EntityId, label: z.string().optional(), kind: z.string().optional() })
	.strict();

const FrameSchema = z
	.object({
		id: EntityId,
		label: z.string().min(1),
		surface: z.enum(SURFACE_KINDS),
		laneId: EntityId,
		order: z.number().int(),
		x: z.number().optional(),
		y: z.number().optional(),
		stateKind: z.string().optional(),
		changeMode: z.enum(CHANGE_MODES),
		coverageStateIds: z.array(EntityId).max(CAPS.STATES_PER_SURFACE).default([]),
		sourceRefIds: z.array(EntityId).max(CAPS.SOURCE_REFS).default([]),
		wireframe: WireframeSchema,
	})
	.strict();

const ConnectorSchema = z
	.object({ id: EntityId, from: EntityId, to: EntityId, label: z.string().optional() })
	.strict();

const AnnotationSchema = z
	.object({
		id: EntityId,
		kind: z.enum(["note", "markup"]),
		text: z.string().min(1),
		targetId: EntityId.optional(),
		placement: z.enum(["top", "right", "bottom", "left"]).optional(),
		points: z.array(z.object({ x: z.number(), y: z.number() }).strict()).optional(),
	})
	.strict();

const CanvasSchema = z
	.object({
		lanes: z.array(LaneSchema).max(CAPS.LANES),
		frames: z.array(FrameSchema).max(CAPS.FRAMES),
		connectors: z.array(ConnectorSchema).max(CAPS.CONNECTORS),
		annotations: z.array(AnnotationSchema).max(CAPS.ANNOTATIONS),
	})
	.strict();

const DocumentBlockSchema = z
	.object({ id: EntityId, title: z.string().optional(), body: z.string() })
	.strict();

const SourceSchema = z
	.object({
		planPath: z.string().min(1),
		planHash: z.string(),
		phaseHashes: z.record(z.string(), z.string()),
	})
	.strict();

const ReviewSchema = z
	.object({
		status: z.enum(REVIEW_STATUSES),
		approvedRevision: z.number().int().nonnegative().nullable().default(null),
		approvedAt: z.string().nullable().default(null),
		pendingFeedbackBatchIds: z.array(z.string()).default([]),
	})
	.strict();

export const VisualPlanSchema = z
	.object({
		schemaVersion: z.literal("visual-plan/v1"),
		id: EntityId,
		revision: z.number().int().nonnegative(),
		source: SourceSchema,
		uiCoverage: UiCoverageSchema,
		canvas: CanvasSchema,
		documentBlocks: z.array(DocumentBlockSchema).max(CAPS.DOCUMENT_BLOCKS).default([]),
		sourceRefs: z.array(SourceRefSchema).max(CAPS.SOURCE_REFS).default([]),
		review: ReviewSchema,
	})
	.passthrough();

export type VisualPlan = z.infer<typeof VisualPlanSchema>;
export type Frame = z.infer<typeof FrameSchema>;
export type CoverageState = z.infer<typeof CoverageStateSchema>;
export type CoverageSurface = z.infer<typeof CoverageSurfaceSchema>;
