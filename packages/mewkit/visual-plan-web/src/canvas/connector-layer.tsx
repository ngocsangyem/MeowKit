/**
 * SVG connector layer — draws each connector as a dominant-axis Bézier between
 * the facing edges of its two frames, with an optional midpoint label. Sits in
 * world space beneath the artboards (pointer-events none so it never blocks
 * frame selection). Connectors whose endpoints are missing are skipped (the
 * validator rejects dangling endpoints upstream).
 */

import type { Connector } from "../domain/artifact-types.js";
import type { PlacedFrame } from "./lane-layout.js";
import { routeConnector, bezierPath, type Box } from "./connector-geometry.js";

interface Props {
	connectors: Connector[];
	placedById: Map<string, PlacedFrame>;
	width: number;
	height: number;
}

const toBox = (p: PlacedFrame): Box => ({ x: p.x, y: p.y, width: p.width, height: p.height });

export function ConnectorLayer({ connectors, placedById, width, height }: Props) {
	return (
		<svg className="vp-connector-layer" width={width} height={height} aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}>
			<defs>
				<marker id="vp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
					<path d="M 0 0 L 10 5 L 0 10 z" className="vp-connector-arrow" />
				</marker>
			</defs>
			{connectors.map((c) => {
				const from = placedById.get(c.from);
				const to = placedById.get(c.to);
				if (!from || !to) return null;
				const route = routeConnector(toBox(from), toBox(to));
				return (
					<g key={c.id} className="vp-connector">
						<path d={bezierPath(route)} className="vp-connector-path" fill="none" markerEnd="url(#vp-arrow)" />
						{c.label ? (
							<text x={route.mid.x} y={route.mid.y - 4} className="vp-connector-label" textAnchor="middle">{c.label}</text>
						) : null}
					</g>
				);
			})}
		</svg>
	);
}
