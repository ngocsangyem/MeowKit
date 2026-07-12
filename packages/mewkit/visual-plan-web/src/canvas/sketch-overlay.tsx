/**
 * Sketch-mode overlay — hand-drawn artboard borders via rough.js, drawn over the
 * measured artboard rectangles in world space. Sketch mode is a render-MODE
 * toggle, never a schema field: clean mode (CSS borders) is the default and the
 * normative renderer for tests; this overlay only adds the hand-drawn strokes
 * when sketch mode is on. Non-interactive (pointer-events: none).
 */

import { useEffect, useRef } from "react";
import rough from "roughjs";
import type { PlacedFrame } from "./lane-layout.js";

interface Props {
	frames: PlacedFrame[];
	width: number;
	height: number;
}

export function SketchOverlay({ frames, width, height }: Props) {
	const ref = useRef<SVGSVGElement>(null);

	useEffect(() => {
		const svg = ref.current;
		if (!svg) return;
		while (svg.firstChild) svg.removeChild(svg.firstChild);
		const rc = rough.svg(svg);
		for (const f of frames) {
			svg.appendChild(rc.rectangle(f.x, f.y, f.width, f.height, { roughness: 1.4, stroke: "#64707d", strokeWidth: 1.4 }));
		}
	}, [frames]);

	return (
		<svg
			ref={ref}
			className="vp-sketch-overlay"
			width={width}
			height={height}
			aria-hidden="true"
			style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}
		/>
	);
}
