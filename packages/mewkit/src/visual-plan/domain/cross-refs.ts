/**
 * Cross-reference integrity for a schema-valid `visual-plan/v1` artifact.
 *
 * Agent-native only checks id uniqueness + `frame.blockId`, and its renderer
 * silently SKIPS dangling connector endpoints, annotation targets, and section
 * artboard ids (verified gap). MeowKit rejects every dangling reference with an
 * exact JSON path so nothing renders-by-omission.
 *
 * Two passes: (1) every id is unique across ALL entity kinds; (2) every
 * reference resolves to a declared id. Equivalence-cycle detection lives in
 * `coverage.ts` (it needs the closure walk).
 */

import { err, ErrorCode, type ValidationError } from "./errors.js";
import type { VisualPlan } from "./schemas.js";

/** Collect every declared id with the JSON path where it was declared. */
function collectIds(plan: VisualPlan): { seen: Map<string, string>; errors: ValidationError[] } {
	const seen = new Map<string, string>();
	const errors: ValidationError[] = [];
	const add = (id: string, path: string): void => {
		const prior = seen.get(id);
		if (prior !== undefined) {
			errors.push(err(path, ErrorCode.DUPLICATE_ID, `id "${id}" already declared at ${prior}`));
			return;
		}
		seen.set(id, path);
	};
	plan.canvas.lanes.forEach((l, i) => add(l.id, `canvas.lanes[${i}].id`));
	plan.canvas.frames.forEach((f, i) => add(f.id, `canvas.frames[${i}].id`));
	plan.canvas.connectors.forEach((c, i) => add(c.id, `canvas.connectors[${i}].id`));
	plan.canvas.annotations.forEach((a, i) => add(a.id, `canvas.annotations[${i}].id`));
	plan.documentBlocks.forEach((b, i) => add(b.id, `documentBlocks[${i}].id`));
	plan.sourceRefs.forEach((s, i) => add(s.id, `sourceRefs[${i}].id`));
	plan.uiCoverage.surfaces.forEach((s, si) => {
		add(s.id, `uiCoverage.surfaces[${si}].id`);
		s.states.forEach((st, ti) => add(st.id, `uiCoverage.surfaces[${si}].states[${ti}].id`));
	});
	return { seen, errors };
}

/** Build the typed id sets used to resolve references. */
function idSets(plan: VisualPlan): {
	frames: Set<string>;
	lanes: Set<string>;
	states: Set<string>;
	sourceRefs: Set<string>;
} {
	return {
		frames: new Set(plan.canvas.frames.map((f) => f.id)),
		lanes: new Set(plan.canvas.lanes.map((l) => l.id)),
		sourceRefs: new Set(plan.sourceRefs.map((s) => s.id)),
		states: new Set(plan.uiCoverage.surfaces.flatMap((s) => s.states.map((st) => st.id))),
	};
}

/**
 * Validate uniqueness + reference resolution. Returns every finding; an empty
 * array means the artifact is referentially sound.
 */
export function checkCrossReferences(plan: VisualPlan): ValidationError[] {
	const { errors } = collectIds(plan);
	const ids = idSets(plan);
	const need = (
		id: string,
		set: Set<string>,
		path: string,
		code: (typeof ErrorCode)[keyof typeof ErrorCode],
		kind: string,
	): void => {
		if (!set.has(id)) errors.push(err(path, code, `references unknown ${kind} "${id}"`));
	};

	plan.canvas.connectors.forEach((c, i) => {
		need(c.from, ids.frames, `canvas.connectors[${i}].from`, ErrorCode.DANGLING_CONNECTOR_ENDPOINT, "frame");
		need(c.to, ids.frames, `canvas.connectors[${i}].to`, ErrorCode.DANGLING_CONNECTOR_ENDPOINT, "frame");
	});

	plan.canvas.frames.forEach((f, i) => {
		need(f.laneId, ids.lanes, `canvas.frames[${i}].laneId`, ErrorCode.DANGLING_LANE, "lane");
		f.coverageStateIds.forEach((sid, j) =>
			need(sid, ids.states, `canvas.frames[${i}].coverageStateIds[${j}]`, ErrorCode.DANGLING_COVERAGE_FRAME, "coverage state"),
		);
		f.sourceRefIds.forEach((sid, j) =>
			need(sid, ids.sourceRefs, `canvas.frames[${i}].sourceRefIds[${j}]`, ErrorCode.DANGLING_SOURCE_REF, "source ref"),
		);
	});

	plan.uiCoverage.surfaces.forEach((s, si) =>
		s.states.forEach((st, ti) => {
			const base = `uiCoverage.surfaces[${si}].states[${ti}]`;
			st.frameIds.forEach((fid, j) =>
				need(fid, ids.frames, `${base}.frameIds[${j}]`, ErrorCode.DANGLING_COVERAGE_FRAME, "frame"),
			);
			st.sourceRefIds.forEach((sid, j) =>
				need(sid, ids.sourceRefs, `${base}.sourceRefIds[${j}]`, ErrorCode.DANGLING_SOURCE_REF, "source ref"),
			);
		}),
	);

	checkAnnotations(plan, ids.frames, errors);
	return errors;
}

/** Annotation shape + target resolution: `note` is anchored, `markup` is free. */
function checkAnnotations(plan: VisualPlan, frames: Set<string>, errors: ValidationError[]): void {
	plan.canvas.annotations.forEach((a, i) => {
		const base = `canvas.annotations[${i}]`;
		if (a.kind === "note") {
			if (a.targetId === undefined || a.placement === undefined) {
				errors.push(err(`${base}`, ErrorCode.DANGLING_ANNOTATION_TARGET, "note annotation requires targetId + placement"));
			} else if (!frames.has(a.targetId)) {
				errors.push(err(`${base}.targetId`, ErrorCode.DANGLING_ANNOTATION_TARGET, `references unknown frame "${a.targetId}"`));
			}
		} else if (a.points === undefined || a.points.length === 0) {
			errors.push(err(`${base}.points`, ErrorCode.DANGLING_ANNOTATION_TARGET, "markup annotation requires at least one point"));
		}
	});
}
