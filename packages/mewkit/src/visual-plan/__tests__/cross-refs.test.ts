/**
 * Cross-reference integrity: id uniqueness across all entity kinds and
 * resolution of every reference (connector endpoints, annotation targets, lane
 * membership, coverage frame refs, source refs) with the annotation shape rules.
 */

import { describe, expect, it } from "vitest";
import { checkCrossReferences } from "../domain/cross-refs.js";
import { VisualPlanSchema, type VisualPlan } from "../domain/schemas.js";
import { ErrorCode } from "../domain/errors.js";
import { makeValidPlan } from "../__fixtures__/valid-plan.js";

function planWith(mutate: (p: Record<string, unknown>) => void): VisualPlan {
	const raw = makeValidPlan();
	mutate(raw);
	return VisualPlanSchema.parse(raw);
}

/** Typed accessor into the canvas of the mutable plain fixture. */
function canvas(p: Record<string, unknown>): {
	frames: { id: string; laneId: string; sourceRefIds: string[]; coverageStateIds: string[] }[];
	connectors: { from: string; to: string }[];
	annotations: { kind: string; targetId?: string; placement?: string; points?: unknown[] }[];
} {
	return p.canvas as never;
}

it("accepts the valid fixture with no cross-reference errors", () => {
	expect(checkCrossReferences(VisualPlanSchema.parse(makeValidPlan()))).toEqual([]);
});

describe("uniqueness", () => {
	it("rejects a duplicate id across entity kinds", () => {
		const plan = planWith((p) => {
			canvas(p).frames[1].id = "fr-login";
		});
		const errs = checkCrossReferences(plan);
		expect(errs.some((e) => e.code === ErrorCode.DUPLICATE_ID)).toBe(true);
	});
});

describe("dangling references", () => {
	it("rejects a dangling connector endpoint with a JSON path", () => {
		const plan = planWith((p) => {
			canvas(p).connectors[0].to = "fr-ghost";
		});
		const err = checkCrossReferences(plan).find((e) => e.code === ErrorCode.DANGLING_CONNECTOR_ENDPOINT);
		expect(err?.path).toBe("canvas.connectors[0].to");
	});

	it("rejects a dangling annotation targetId", () => {
		const plan = planWith((p) => {
			canvas(p).annotations[0].targetId = "fr-ghost";
		});
		expect(checkCrossReferences(plan).some((e) => e.code === ErrorCode.DANGLING_ANNOTATION_TARGET)).toBe(true);
	});

	it("rejects a dangling laneId", () => {
		const plan = planWith((p) => {
			canvas(p).frames[0].laneId = "lane-ghost";
		});
		expect(checkCrossReferences(plan).some((e) => e.code === ErrorCode.DANGLING_LANE)).toBe(true);
	});

	it("rejects a dangling coverage frame reference", () => {
		const plan = planWith((p) => {
			canvas(p).frames[0].coverageStateIds = ["st-ghost"];
		});
		expect(checkCrossReferences(plan).some((e) => e.code === ErrorCode.DANGLING_COVERAGE_FRAME)).toBe(true);
	});

	it("rejects a dangling source ref", () => {
		const plan = planWith((p) => {
			canvas(p).frames[0].sourceRefIds = ["ref-ghost"];
		});
		expect(checkCrossReferences(plan).some((e) => e.code === ErrorCode.DANGLING_SOURCE_REF)).toBe(true);
	});
});

describe("annotation shape", () => {
	it("rejects a note annotation missing its target/placement", () => {
		const plan = planWith((p) => {
			const a = canvas(p).annotations[0];
			delete a.targetId;
			delete a.placement;
		});
		expect(checkCrossReferences(plan).some((e) => e.code === ErrorCode.DANGLING_ANNOTATION_TARGET)).toBe(true);
	});

	it("rejects a markup annotation with no points", () => {
		const plan = planWith((p) => {
			const a = canvas(p).annotations[0];
			a.kind = "markup";
			delete a.targetId;
			delete a.placement;
		});
		expect(checkCrossReferences(plan).some((e) => e.code === ErrorCode.DANGLING_ANNOTATION_TARGET)).toBe(true);
	});
});
