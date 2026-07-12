/**
 * Connector geometry: dominant-axis selection, facing-edge attachment, and a
 * well-formed cubic Bézier path.
 */

import { describe, expect, it } from "vitest";
import { routeConnector, bezierPath, type Box } from "../canvas/connector-geometry.js";

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

describe("bezierPath", () => {
	it("produces a cubic Bézier from start to end", () => {
		const r = routeConnector(box(0, 0), box(300, 0));
		const d = bezierPath(r);
		expect(d).toMatch(/^M 100 30 C .* 300 30$/);
	});
});
