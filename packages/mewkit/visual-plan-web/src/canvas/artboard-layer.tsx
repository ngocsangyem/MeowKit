/**
 * Artboard layer — each frame as a surface-locked DOM board at its computed
 * position. A header carries the label, surface badge, and change-mode; the
 * body renders the sanitized wireframe clipped to the surface footprint.
 * Clicking an artboard selects it (drives the read-only inspector).
 */

import type { Frame } from "../domain/artifact-types.js";
import type { PlacedFrame } from "./lane-layout.js";
import { WireframeFrame } from "../wireframe/wireframe-frame.js";

interface Props {
	placed: PlacedFrame[];
	framesById: Map<string, Frame>;
	selectedId: string | null;
	onSelect: (id: string) => void;
}

export function ArtboardLayer({ placed, framesById, selectedId, onSelect }: Props) {
	return (
		<div className="vp-artboard-layer">
			{placed.map((p) => {
				const frame = framesById.get(p.id);
				if (!frame) return null;
				const selected = p.id === selectedId;
				return (
					<div
						key={p.id}
						className={`vp-artboard${selected ? " is-selected" : ""}`}
						data-frame-id={p.id}
						style={{ position: "absolute", left: p.x, top: p.y, width: p.width, height: p.height }}
						role="button"
						tabIndex={0}
						aria-pressed={selected}
						aria-label={`${frame.label} (${frame.surface})`}
						onClick={() => onSelect(p.id)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onSelect(p.id);
							}
						}}
					>
						<div className="vp-artboard-header">
							<span className="vp-artboard-title">{frame.label}</span>
							<span className="vp-artboard-surface" data-change={frame.changeMode}>{frame.surface}</span>
						</div>
						<div className="vp-artboard-body" style={{ width: p.width, height: p.height }}>
							<WireframeFrame html={frame.wireframe.html} />
						</div>
					</div>
				);
			})}
		</div>
	);
}
