/**
 * Sketch overlay: rough.js draws a hand-drawn border per artboard. Verifies the
 * overlay emits path geometry for each frame (the hand-drawn strokes) and is
 * inert/aria-hidden.
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SketchOverlay } from "../canvas/sketch-overlay.js";
import type { PlacedFrame } from "../canvas/lane-layout.js";

const frame = (id: string, x: number): PlacedFrame => ({ id, laneId: "l1", x, y: 0, width: 100, height: 60 });

describe("SketchOverlay", () => {
	it("renders hand-drawn paths for each frame", () => {
		const { container } = render(<SketchOverlay frames={[frame("f1", 0), frame("f2", 200)]} width={400} height={200} />);
		const svg = container.querySelector("svg.vp-sketch-overlay");
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute("aria-hidden")).toBe("true");
		expect(container.querySelectorAll("path").length).toBeGreaterThan(0); // rough strokes present
	});

	it("renders nothing to break with zero frames", () => {
		const { container } = render(<SketchOverlay frames={[]} width={100} height={100} />);
		expect(container.querySelectorAll("path").length).toBe(0);
	});
});
