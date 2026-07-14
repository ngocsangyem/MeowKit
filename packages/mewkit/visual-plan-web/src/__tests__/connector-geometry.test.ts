/**
 * Connector geometry: dominant-axis selection, facing-edge attachment, and a
 * well-formed orthogonal elbow path + open-V arrowhead.
 */

import { describe, expect, it } from "vitest";
import { routeConnector, elbowPath, arrowHeadPath, type Box } from "../canvas/connector-geometry.js";

const box = (x: number, y: number, width = 100, height = 60): Box => ({ x, y, width, height });

describe("routeConnector", () => {
	it("attaches on the x axis (right→left) when horizontally dominant", () => {
		const r = routeConnector(box(0, 0), box(300, 10));
		expect(r.dominant).toBe("x");
		expect(r.start.x).toBe(100); // from's right edge
		expect(r.end.x).toBe(300); // to's left edge
	});

	it("attaches on the y axis (bottom→top) when vertically dominant", () => {
		const r = routeConnector(box(0, 0), box(10, 300));
		expect(r.dominant).toBe("y");
		expect(r.start.y).toBe(60); // from's bottom edge
		expect(r.end.y).toBe(300); // to's top edge
	});

	it("attaches right→... going leftward too (negative dx)", () => {
		const r = routeConnector(box(300, 0), box(0, 0));
		expect(r.dominant).toBe("x");
		expect(r.start.x).toBe(300); // from's left edge
		expect(r.end.x).toBe(100); // to's right edge
	});
});

describe("elbowPath", () => {
	it("routes an orthogonal elbow through the mid axis (x-dominant)", () => {
		const r = routeConnector(box(0, 0), box(300, 100));
		// start (100, 30) → mid axis x=200 → end (300, 130)
		expect(elbowPath(r)).toBe("M 100 30 L 200 30 L 200 130 L 300 130");
	});

	it("collapses to a straight line when endpoints are aligned", () => {
		const r = routeConnector(box(0, 0), box(300, 0));
		expect(elbowPath(r)).toBe("M 100 30 L 200 30 L 200 30 L 300 30");
	});
});

describe("arrowHeadPath", () => {
	it("draws an open V at the end, swept back along the incoming segment", () => {
		const r = routeConnector(box(0, 0), box(300, 0));
		const d = arrowHeadPath(r);
		// Two arms meeting at the end point (300, 30); arms sit LEFT of the tip
		// (incoming direction is +x) and straddle it vertically.
		const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
		expect(nums).toHaveLength(6);
		const [a1x, a1y, tipX, tipY, a2x, a2y] = nums as [number, number, number, number, number, number];
		expect(tipX).toBe(300);
		expect(tipY).toBe(30);
		expect(a1x).toBeLessThan(300);
		expect(a2x).toBeLessThan(300);
		expect(a1y).toBeLessThan(30);
		expect(a2y).toBeGreaterThan(30);
	});
});
