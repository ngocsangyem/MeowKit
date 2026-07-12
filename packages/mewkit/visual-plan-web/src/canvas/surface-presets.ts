/**
 * Surface footprint presets. The MODEL never carries frame dimensions — the
 * surface preset owns the footprint (Phase-1 schema has no width/height on
 * frames). Starting values are from the approved design; the renderer treats
 * these as fixed so layout is deterministic across machines.
 */

import type { Surface } from "../domain/artifact-types.js";

export interface Size {
	width: number;
	height: number;
}

export const SURFACE_PRESETS: Record<Surface, Size> = {
	browser: { width: 900, height: 560 },
	desktop: { width: 840, height: 520 },
	mobile: { width: 300, height: 624 },
	popover: { width: 360, height: 360 },
	panel: { width: 420, height: 560 },
	dialog: { width: 520, height: 420 },
};

/** Footprint for a surface (defaults to browser for any unknown value). */
export function sizeForSurface(surface: Surface): Size {
	return SURFACE_PRESETS[surface] ?? SURFACE_PRESETS.browser;
}
