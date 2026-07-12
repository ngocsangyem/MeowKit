/**
 * Deterministic lane layout: surface-preset footprints, order-then-id sorting,
 * no horizontal overlap within a lane, non-overlapping lane bands, and honoring
 * explicit x/y.
 */

import { describe, expect, it } from "vitest";
import { layoutCanvas } from "../canvas/lane-layout.js";
import { SURFACE_PRESETS } from "../canvas/surface-presets.js";
import type { Frame, Lane } from "../domain/artifact-types.js";

function frame(id: string, laneId: string, order: number, surface: Frame["surface"] = "browser", extra: Partial<Frame> = {}): Frame {
	return {
		id, laneId, order, surface, label: id, changeMode: "current",
		coverageStateIds: [], sourceRefIds: [], wireframe: { format: "semantic-html", html: "<section></section>" },
		...extra,
	};
}
const lane = (id: string): Lane => ({ id, label: id });

describe("layoutCanvas", () => {
	it("applies surface-preset footprints", () => {
		const out = layoutCanvas([lane("l1")], [frame("f1", "l1", 0, "mobile")]);
		const placed = out.frames[0];
		expect(placed.width).toBe(SURFACE_PRESETS.mobile.width);
		expect(placed.height).toBe(SURFACE_PRESETS.mobile.height);
	});

	it("is deterministic and orders by order then id", () => {
		const frames = [frame("b", "l1", 1), frame("a", "l1", 0)];
		const a = layoutCanvas([lane("l1")], frames);
		const b = layoutCanvas([lane("l1")], [...frames].reverse());
		expect(a).toEqual(b); // input order irrelevant
		expect(a.frames.map((f) => f.id)).toEqual(["a", "b"]); // sorted by order
	});

	it("lays two frames in a lane left-to-right with no overlap", () => {
		const out = layoutCanvas([lane("l1")], [frame("f1", "l1", 0), frame("f2", "l1", 1)]);
		const [p1, p2] = out.frames;
		expect(p2.x).toBeGreaterThanOrEqual(p1.x + p1.width); // no horizontal overlap
		expect(p1.y).toBe(p2.y); // same row
	});

	it("stacks lanes into non-overlapping vertical bands", () => {
		const out = layoutCanvas([lane("l1"), lane("l2")], [frame("f1", "l1", 0), frame("f2", "l2", 0)]);
		const [b1, b2] = out.lanes;
		expect(b2.y).toBeGreaterThanOrEqual(b1.y + b1.height);
	});

	it("honors explicit x/y when both are present", () => {
		const out = layoutCanvas([lane("l1")], [frame("f1", "l1", 0, "browser", { x: 1234, y: 567 })]);
		expect(out.frames[0].x).toBe(1234);
		expect(out.frames[0].y).toBe(567);
	});

	it("mixes wide and compact surfaces without overlap", () => {
		const out = layoutCanvas([lane("l1")], [frame("f1", "l1", 0, "browser"), frame("f2", "l1", 1, "mobile")]);
		const [p1, p2] = out.frames;
		expect(p2.x).toBeGreaterThanOrEqual(p1.x + p1.width);
	});
});
