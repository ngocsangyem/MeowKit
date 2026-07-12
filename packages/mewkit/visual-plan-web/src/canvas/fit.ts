/**
 * Pure viewport math — extracted so auto-fit and cursor-anchored zoom are
 * unit-testable without a DOM. The canvas world is transformed
 * `translate(pan) scale(zoom)`; these helpers compute pan/zoom deterministically.
 */

export const ZOOM_MIN = 0.18;
export const ZOOM_MAX = 2.4;

export interface Viewport {
	zoom: number;
	panX: number;
	panY: number;
}

/** Clamp a zoom level into the allowed range. */
export function clampZoom(z: number): number {
	return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * Fit a `world`-sized canvas into a `view`-sized container: scale to contain
 * (with margin) and center. Deterministic given the four dimensions.
 */
export function computeFit(worldW: number, worldH: number, viewW: number, viewH: number, margin = 48): Viewport {
	if (worldW <= 0 || worldH <= 0 || viewW <= 0 || viewH <= 0) return { zoom: 1, panX: 0, panY: 0 };
	const zoom = clampZoom(Math.min((viewW - margin * 2) / worldW, (viewH - margin * 2) / worldH));
	return {
		zoom,
		panX: (viewW - worldW * zoom) / 2,
		panY: (viewH - worldH * zoom) / 2,
	};
}

/**
 * Zoom around a cursor point so the world coordinate under the cursor stays put.
 * `cx`/`cy` are cursor coordinates in the container's local space.
 */
export function zoomAtPoint(vp: Viewport, factor: number, cx: number, cy: number): Viewport {
	const nextZoom = clampZoom(vp.zoom * factor);
	const scale = nextZoom / vp.zoom;
	return {
		zoom: nextZoom,
		panX: cx - (cx - vp.panX) * scale,
		panY: cy - (cy - vp.panY) * scale,
	};
}
