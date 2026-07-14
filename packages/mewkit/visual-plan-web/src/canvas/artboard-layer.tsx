/**
 * Artboard layer — each frame as a surface-locked board at its computed
 * position. Chrome-less presentation (agent-native pattern): the caption
 * (label + surface badge + change-mode) floats ABOVE the frame, the body is a
 * rounded paper rect whose radius comes from the surface preset (mobile bezel
 * 30, window 14…). In sketchy mode a per-element rough overlay redraws the
 * frame + wireframe outlines hand-drawn. Clicking selects (drives inspector).
 */

import type { Frame } from "../domain/artifact-types.js";
import type { PlacedFrame } from "./lane-layout.js";
import { sizeForSurface } from "./surface-presets.js";
import { WireframeFrame } from "../wireframe/wireframe-frame.js";
import { RoughElementOverlay } from "./rough-element-overlay.js";

interface Props {
	placed: PlacedFrame[];
	framesById: Map<string, Frame>;
	selectedId: string | null;
	sketch: boolean;
	onSelect: (id: string) => void;
}

export function ArtboardLayer({ placed, framesById, selectedId, sketch, onSelect }: Props) {
	return (
		<div className="vp-artboard-layer">
			{placed.map((p) => {
				const frame = framesById.get(p.id);
				if (!frame) return null;
				const selected = p.id === selectedId;
				const { radius } = sizeForSurface(frame.surface);
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
						<div className="vp-artboard-caption">
							<span className="vp-artboard-title">{frame.label}</span>
							<span className="vp-artboard-surface" data-change={frame.changeMode}>
								{frame.surface}
								{frame.changeMode === "target" ? " · target" : ""}
							</span>
						</div>
						<div className="vp-artboard-body" style={{ borderRadius: radius }}>
							<WireframeFrame html={frame.wireframe.html} />
							{sketch ? <RoughElementOverlay frameId={p.id} radius={radius} html={frame.wireframe.html} /> : null}
						</div>
					</div>
				);
			})}
		</div>
	);
}
