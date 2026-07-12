/**
 * Deterministic lane layout — no physics solver.
 *
 * Lanes stack top-to-bottom; within a lane, frames sort by `order` (ties broken
 * by id for stability) and lay out left-to-right with constant spacing. A frame
 * footprint comes from its surface preset. Explicit `x`/`y` on a frame are
 * honored verbatim (both must be present); otherwise a slot is generated. This
 * intentionally differs from agent-native's non-reusable auto-layout heuristic:
 * same input → same output, every run.
 */

import type { Frame, Lane } from "../domain/artifact-types.js";
import { sizeForSurface } from "./surface-presets.js";

const PAD = 48;
const GAP_X = 64;
const GAP_Y = 96;
const LANE_LABEL_H = 40;
const DEFAULT_LANE_H = 200;

export interface PlacedFrame {
	id: string;
	laneId: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface LaneBox {
	id: string;
	label: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Layout {
	frames: PlacedFrame[];
	lanes: LaneBox[];
	width: number;
	height: number;
}

/** Sort a lane's frames by order, then id — stable and machine-independent. */
function sortFrames(frames: Frame[]): Frame[] {
	return [...frames].sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id));
}

/**
 * Compute positioned frames + lane boxes + the world bounds. Frames whose laneId
 * is not among `lanes` are dropped from layout (the validator rejects dangling
 * laneIds upstream, so this only guards a malformed artifact).
 */
export function layoutCanvas(lanes: Lane[], frames: Frame[]): Layout {
	const placed: PlacedFrame[] = [];
	const laneBoxes: LaneBox[] = [];
	let laneTop = PAD;
	let worldRight = PAD;

	for (const lane of lanes) {
		const laneFrames = sortFrames(frames.filter((f) => f.laneId === lane.id));
		const rowTop = laneTop + LANE_LABEL_H;
		let cursorX = PAD;
		let laneContentH = 0;

		for (const frame of laneFrames) {
			const { width, height } = sizeForSurface(frame.surface);
			const hasExplicit = typeof frame.x === "number" && typeof frame.y === "number";
			const x = hasExplicit ? (frame.x as number) : cursorX;
			const y = hasExplicit ? (frame.y as number) : rowTop;
			placed.push({ id: frame.id, laneId: lane.id, x, y, width, height });
			if (!hasExplicit) cursorX = x + width + GAP_X;
			laneContentH = Math.max(laneContentH, y - rowTop + height);
			worldRight = Math.max(worldRight, x + width);
		}

		const laneH = LANE_LABEL_H + Math.max(laneContentH, DEFAULT_LANE_H);
		laneBoxes.push({ id: lane.id, label: lane.label ?? lane.id, x: PAD, y: laneTop, width: 0, height: laneH });
		laneTop += laneH + GAP_Y;
	}

	const width = worldRight + PAD;
	const height = laneTop - GAP_Y + PAD;
	// Lane boxes span the full world width (computed after all frames placed).
	for (const box of laneBoxes) box.width = width - PAD * 2;
	return { frames: placed, lanes: laneBoxes, width, height };
}
