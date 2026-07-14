/**
 * Connector geometry — pure, deterministic edge attachment + orthogonal
 * (elbow) routing with an open-V arrowhead, matching the agent-native canvas
 * language: connectors leave/enter perpendicular to the facing edges, turn on
 * a shared mid-axis, and end in a two-stroke hand-drawn "V" (no filled
 * triangle). No physics, no overlap solve.
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
	/** Label anchor — midway between the attachment points. */
	mid: Point;
}

/** Arrowhead arm length / half-spread (radians) — open "V", agent-native style. */
const HEAD_LEN = 11;
const HEAD_SPREAD = 0.45;

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

/** Orthogonal elbow path: out along the dominant axis, turn on the mid-axis, in. */
export function elbowPath(route: Route): string {
	const { start: s, end: e, dominant } = route;
	if (dominant === "x") {
		const midX = (s.x + e.x) / 2;
		return `M ${s.x} ${s.y} L ${midX} ${s.y} L ${midX} ${e.y} L ${e.x} ${e.y}`;
	}
	const midY = (s.y + e.y) / 2;
	return `M ${s.x} ${s.y} L ${s.x} ${midY} L ${e.x} ${midY} L ${e.x} ${e.y}`;
}

/**
 * Open-V arrowhead at the route's end: two arms swept back along the incoming
 * (final elbow segment) direction. Returned as a bare path string.
 */
export function arrowHeadPath(route: Route): string {
	const { start: s, end: e, dominant } = route;
	// The final elbow segment runs along the dominant axis into the end point.
	const angle = dominant === "x"
		? Math.atan2(0, e.x - (s.x + e.x) / 2 || 1)
		: Math.atan2(e.y - (s.y + e.y) / 2 || 1, 0);
	const back = angle + Math.PI;
	const a1 = { x: e.x + HEAD_LEN * Math.cos(back + HEAD_SPREAD), y: e.y + HEAD_LEN * Math.sin(back + HEAD_SPREAD) };
	const a2 = { x: e.x + HEAD_LEN * Math.cos(back - HEAD_SPREAD), y: e.y + HEAD_LEN * Math.sin(back - HEAD_SPREAD) };
	return `M ${a1.x} ${a1.y} L ${e.x} ${e.y} L ${a2.x} ${a2.y}`;
}
