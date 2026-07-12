/**
 * Lane backgrounds + labels, rendered behind the artboards in world space.
 * Pure presentational layer driven by the deterministic layout's lane boxes.
 */

import type { LaneBox } from "./lane-layout.js";

export function LaneLayer({ lanes }: { lanes: LaneBox[] }) {
	return (
		<div className="vp-lane-layer" aria-hidden="true">
			{lanes.map((lane) => (
				<div
					key={lane.id}
					className="vp-lane"
					style={{ position: "absolute", left: lane.x, top: lane.y, width: lane.width, height: lane.height }}
				>
					<div className="vp-lane-label">{lane.label}</div>
				</div>
			))}
		</div>
	);
}
