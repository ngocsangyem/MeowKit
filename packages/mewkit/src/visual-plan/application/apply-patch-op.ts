/**
 * Apply a single typed visual patch op to a parsed plan (mutates in place).
 *
 * Returns an error message when the op cannot apply (unknown target, duplicate
 * append, unknown wireframe field); the orchestrator rejects the patch and never
 * writes. Structural/coverage/safety re-validation is the orchestrator's job —
 * this function only performs the mutation and the immediate target checks.
 */

import type { PatchOp } from "../domain/patches.js";
import type { VisualPlan, Annotation } from "../domain/schemas.js";
import { editWireframeField } from "../infrastructure/wireframe-sanitizer.js";

/** Mutate `plan` by `op`. Returns null on success, or an error message. */
export function applyPatchOp(plan: VisualPlan, op: PatchOp): string | null {
	switch (op.type) {
		case "move-frame-lane": {
			const frame = plan.canvas.frames.find((f) => f.id === op.frameId);
			if (!frame) return `unknown frame "${op.frameId}"`;
			if (!plan.canvas.lanes.some((l) => l.id === op.laneId)) return `unknown lane "${op.laneId}"`;
			frame.laneId = op.laneId;
			return null;
		}
		case "reorder-frame": {
			const frame = plan.canvas.frames.find((f) => f.id === op.frameId);
			if (!frame) return `unknown frame "${op.frameId}"`;
			frame.order = op.order;
			return null;
		}
		case "update-annotation": {
			const a = plan.canvas.annotations.find((x) => x.id === op.annotationId);
			if (!a) return `unknown annotation "${op.annotationId}"`;
			if (op.text !== undefined) a.text = op.text;
			if (op.placement !== undefined) a.placement = op.placement;
			if (op.points !== undefined) a.points = op.points;
			return null;
		}
		case "append-annotation": {
			const anno = op.annotation as Annotation;
			if (plan.canvas.annotations.some((x) => x.id === anno.id)) return `annotation id "${anno.id}" already exists`;
			plan.canvas.annotations.push(anno);
			return null;
		}
		case "remove-annotation": {
			const before = plan.canvas.annotations.length;
			plan.canvas.annotations = plan.canvas.annotations.filter((x) => x.id !== op.annotationId);
			return plan.canvas.annotations.length === before ? `unknown annotation "${op.annotationId}"` : null;
		}
		case "update-connector-label": {
			const c = plan.canvas.connectors.find((x) => x.id === op.connectorId);
			if (!c) return `unknown connector "${op.connectorId}"`;
			c.label = op.label;
			return null;
		}
		case "update-wireframe-field": {
			const frame = plan.canvas.frames.find((f) => f.id === op.frameId);
			if (!frame) return `unknown frame "${op.frameId}"`;
			const edited = editWireframeField(frame.wireframe.html, op.fieldId, op.text);
			if (edited === null) return `no editable field "wf-field-${op.fieldId}" in frame "${op.frameId}"`;
			frame.wireframe.html = edited;
			return null;
		}
	}
}
