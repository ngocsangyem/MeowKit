/**
 * Pan/zoom viewport. Wheel pans; Ctrl/Cmd-wheel zooms around the cursor. Auto-fits
 * the world on mount and when world/container size changes. Keyboard: +/- zoom,
 * arrows pan, 0 resets to fit. Honors `prefers-reduced-motion` (no transition).
 * Renders children in a `translate(pan) scale(zoom)` world.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { computeFit, zoomAtPoint, clampZoom, type Viewport } from "./fit.js";

interface Props {
	worldWidth: number;
	worldHeight: number;
	children: ReactNode;
}

const PAN_STEP = 80;

export function CanvasViewport({ worldWidth, worldHeight, children }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [vp, setVp] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });

	const fit = useCallback(() => {
		const el = containerRef.current;
		if (!el) return;
		setVp(computeFit(worldWidth, worldHeight, el.clientWidth, el.clientHeight));
	}, [worldWidth, worldHeight]);

	useEffect(() => {
		fit();
		const el = containerRef.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver(() => fit());
		ro.observe(el);
		return () => ro.disconnect();
	}, [fit]);

	const onWheel = useCallback((e: React.WheelEvent) => {
		e.preventDefault();
		if (e.ctrlKey || e.metaKey) {
			const rect = containerRef.current?.getBoundingClientRect();
			const cx = e.clientX - (rect?.left ?? 0);
			const cy = e.clientY - (rect?.top ?? 0);
			setVp((v) => zoomAtPoint(v, e.deltaY < 0 ? 1.1 : 1 / 1.1, cx, cy));
		} else {
			setVp((v) => ({ ...v, panX: v.panX - e.deltaX, panY: v.panY - e.deltaY }));
		}
	}, []);

	const onKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key === "+" || e.key === "=") setVp((v) => ({ ...v, zoom: clampZoom(v.zoom * 1.1) }));
		else if (e.key === "-") setVp((v) => ({ ...v, zoom: clampZoom(v.zoom / 1.1) }));
		else if (e.key === "0") fit();
		else if (e.key === "ArrowLeft") setVp((v) => ({ ...v, panX: v.panX + PAN_STEP }));
		else if (e.key === "ArrowRight") setVp((v) => ({ ...v, panX: v.panX - PAN_STEP }));
		else if (e.key === "ArrowUp") setVp((v) => ({ ...v, panY: v.panY + PAN_STEP }));
		else if (e.key === "ArrowDown") setVp((v) => ({ ...v, panY: v.panY - PAN_STEP }));
		else return;
		e.preventDefault();
	}, [fit]);

	return (
		<div
			ref={containerRef}
			className="vp-viewport"
			role="application"
			aria-label="Visual plan canvas"
			tabIndex={0}
			onWheel={onWheel}
			onKeyDown={onKeyDown}
		>
			<div
				className="vp-world"
				style={{
					transform: `translate(${vp.panX}px, ${vp.panY}px) scale(${vp.zoom})`,
					transformOrigin: "0 0",
					width: worldWidth,
					height: worldHeight,
				}}
			>
				{children}
			</div>
			<div className="vp-zoom-controls" role="group" aria-label="Zoom controls">
				<button type="button" aria-label="Zoom out" onClick={() => setVp((v) => ({ ...v, zoom: clampZoom(v.zoom / 1.1) }))}>−</button>
				<span className="vp-zoom-level">{Math.round(vp.zoom * 100)}%</span>
				<button type="button" aria-label="Zoom in" onClick={() => setVp((v) => ({ ...v, zoom: clampZoom(v.zoom * 1.1) }))}>+</button>
				<button type="button" aria-label="Fit to screen" onClick={fit}>Fit</button>
			</div>
		</div>
	);
}
