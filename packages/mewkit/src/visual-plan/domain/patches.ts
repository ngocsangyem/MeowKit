/**
 * Typed VISUAL-ONLY patch operations (Phase 5).
 *
 * These are the only mutations the studio may apply directly to the artifact —
 * lane/order moves, annotation add/edit/remove, connector-label edits, and
 * schema-backed wireframe TEXT-field edits. Raw HTML/CSS editing, freeform
 * resize, and Markdown edits are NOT patch ops (semantic changes go through the
 * feedback→agent loop). Every accepted patch bumps `revision` and clears
 * approval; the application layer re-validates the mutated plan before writing.
 *
 * A wireframe field is targeted by a `wf-field-<id>` CLASS in the wireframe HTML
 * (class is in the sanitizer allowlist, so no allowlist change is needed) — only
 * that element's TEXT content is replaced, then the whole wireframe re-sanitized.
 */

import { z } from "zod";
import { ENTITY_ID_RE } from "./ids.js";
import { AnnotationSchema } from "./schemas.js";

const EntityId = z.string().regex(ENTITY_ID_RE);
const Placement = z.enum(["top", "right", "bottom", "left"]);
const Points = z.array(z.object({ x: z.number(), y: z.number() }).strict());

const MoveFrameLane = z.object({ type: z.literal("move-frame-lane"), frameId: EntityId, laneId: EntityId }).strict();
const ReorderFrame = z
	.object({ type: z.literal("reorder-frame"), frameId: EntityId, order: z.number().int() })
	.strict();
const UpdateAnnotation = z
	.object({
		type: z.literal("update-annotation"),
		annotationId: EntityId,
		text: z.string().min(1).optional(),
		placement: Placement.optional(),
		points: Points.optional(),
	})
	.strict();
const AppendAnnotation = z.object({ type: z.literal("append-annotation"), annotation: AnnotationSchema }).strict();
const RemoveAnnotation = z.object({ type: z.literal("remove-annotation"), annotationId: EntityId }).strict();
const UpdateConnectorLabel = z
	.object({ type: z.literal("update-connector-label"), connectorId: EntityId, label: z.string() })
	.strict();
const UpdateWireframeField = z
	.object({ type: z.literal("update-wireframe-field"), frameId: EntityId, fieldId: EntityId, text: z.string() })
	.strict();

export const PatchOpSchema = z.discriminatedUnion("type", [
	MoveFrameLane,
	ReorderFrame,
	UpdateAnnotation,
	AppendAnnotation,
	RemoveAnnotation,
	UpdateConnectorLabel,
	UpdateWireframeField,
]);

export type PatchOp = z.infer<typeof PatchOpSchema>;
