/**
 * SVG connector layer — orthogonal elbow paths between facing frame edges with
 * an open-V arrowhead and a pill label at the midpoint (agent-native canvas
 * language). Sits in world space beneath the artboards (pointer-events none so
 * it never blocks frame selection). Connectors whose endpoints are missing are
 * skipped (the validator rejects dangling endpoints upstream).
 */

import type { Connector } from "../domain/artifact-types.js";
import type { PlacedFrame } from "./lane-layout.js";
import { routeConnector, elbowPath, arrowHeadPath, type Box } from "./connector-geometry.js";

interface Props {
	connectors: Connector[];
	placedById: Map<string, PlacedFrame>;
	width: number;
	height: number;
}

const toBox = (p: PlacedFrame): Box => ({ x: p.x, y: p.y, width: p.width, height: p.height });

/** Approximate pill width from label length (SVG has no auto-sizing rects). */
const pillWidth = (label: string): number => label.length * 6.6 + 20;

export function ConnectorLayer({ connectors, placedById, width, height }: Props) {
	return (
		<svg className="vp-connector-layer" width={width} height={height} aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}>
			{connectors.map((c) => {
				const from = placedById.get(c.from);
				const to = placedById.get(c.to);
				if (!from || !to) return null;
				const route = routeConnector(toBox(from), toBox(to));
				const w = c.label ? pillWidth(c.label) : 0;
				return (
					<g key={c.id} className="vp-connector">
						<path d={elbowPath(route)} className="vp-connector-path" />
						<path d={arrowHeadPath(route)} className="vp-connector-head" />
						{c.label ? (
							<g>
								<rect className="vp-connector-label-box" x={route.mid.x - w / 2} y={route.mid.y - 11} width={w} height={22} rx={11} />
								<text x={route.mid.x} y={route.mid.y + 4} className="vp-connector-label" textAnchor="middle">{c.label}</text>
							</g>
						) : null}
					</g>
				);
			})}
		</svg>
	);
}
