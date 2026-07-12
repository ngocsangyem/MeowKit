/**
 * Viewport math: zoom clamping, contain-and-center fit, and cursor-anchored zoom
 * keeping the world point under the cursor fixed.
 */

import { describe, expect, it } from "vitest";
import { clampZoom, computeFit, zoomAtPoint, ZOOM_MIN, ZOOM_MAX } from "../canvas/fit.js";

describe("clampZoom", () => {
	it("bounds to [MIN, MAX]", () => {
		expect(clampZoom(0.01)).toBe(ZOOM_MIN);
		expect(clampZoom(99)).toBe(ZOOM_MAX);
		expect(clampZoom(1)).toBe(1);
	});
});

describe("computeFit", () => {
	it("scales to contain and centers", () => {
		const vp = computeFit(1000, 500, 600, 600, 0);
		expect(vp.zoom).toBeCloseTo(0.6, 5); // width-bound: 600/1000
		// centered: panX = (600 - 1000*0.6)/2 = 0 ; panY = (600 - 500*0.6)/2 = 150
		expect(vp.panX).toBeCloseTo(0, 5);
		expect(vp.panY).toBeCloseTo(150, 5);
	});

	it("returns identity for degenerate sizes", () => {
		expect(computeFit(0, 0, 100, 100)).toEqual({ zoom: 1, panX: 0, panY: 0 });
	});
});

describe("zoomAtPoint", () => {
	it("keeps the world point under the cursor fixed", () => {
		const start = { zoom: 1, panX: 0, panY: 0 };
		const cx = 200, cy = 100;
		const worldXBefore = (cx - start.panX) / start.zoom;
		const next = zoomAtPoint(start, 1.5, cx, cy);
		const worldXAfter = (cx - next.panX) / next.zoom;
		expect(worldXAfter).toBeCloseTo(worldXBefore, 5);
		expect(next.zoom).toBeCloseTo(1.5, 5);
	});
});
