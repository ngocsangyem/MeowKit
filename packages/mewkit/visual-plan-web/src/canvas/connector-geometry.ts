/**
 * Connector geometry — pure, deterministic edge attachment + Bézier routing.
 *
 * The facing side of each frame is chosen by the dominant axis between the two
 * frame centers (agent-native uses Béziers, not orthogonal routing — we match
 * that, with control points pulled along the dominant axis so the curve leaves
 * and enters perpendicular to the attached edge). No physics, no overlap solve.
 */

export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Point {
	x: number;
	y: number;
}

export type Axis = "x" | "y";

export interface Route {
	start: Point;
	end: Point;
	dominant: Axis;
	mid: Point;
}

function center(b: Box): Point {
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/**
 * Choose facing-edge attachment points for a connector `from` → `to`. Dominant
 * axis = the larger center-to-center delta; the connector attaches on that axis's
 * facing edges (right/left for x, bottom/top for y).
 */
export function routeConnector(from: Box, to: Box): Route {
	const fc = center(from);
	const tc = center(to);
	const dx = tc.x - fc.x;
	const dy = tc.y - fc.y;
	const dominant: Axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";

	let start: Point;
	let end: Point;
	if (dominant === "x") {
		start = { x: dx >= 0 ? from.x + from.width : from.x, y: fc.y };
		end = { x: dx >= 0 ? to.x : to.x + to.width, y: tc.y };
	} else {
		start = { x: fc.x, y: dy >= 0 ? from.y + from.height : from.y };
		end = { x: tc.x, y: dy >= 0 ? to.y : to.y + to.height };
	}
	return { start, end, dominant, mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } };
}

/** Cubic Bézier path string for a route, with control points along the dominant axis. */
export function bezierPath(route: Route): string {
	const { start: s, end: e, dominant } = route;
	const pull = dominant === "x" ? Math.abs(e.x - s.x) / 2 : Math.abs(e.y - s.y) / 2;
	const c1 = dominant === "x" ? { x: s.x + Math.sign(e.x - s.x || 1) * pull, y: s.y } : { x: s.x, y: s.y + Math.sign(e.y - s.y || 1) * pull };
	const c2 = dominant === "x" ? { x: e.x - Math.sign(e.x - s.x || 1) * pull, y: e.y } : { x: e.x, y: e.y - Math.sign(e.y - s.y || 1) * pull };
	return `M ${s.x} ${s.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`;
}
