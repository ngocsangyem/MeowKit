/**
 * Per-element rough overlay — the hand-drawn register. Measures the laid-out
 * wireframe elements inside ONE artboard (buttons, inputs, cards, badges,
 * list rows, media, hr) and redraws each outline as a seeded rough.js stroke
 * in an SVG covering the artboard body; the frame outline itself is drawn as
 * a rounded rough rect. Once strokes are drawn it stamps
 * `data-rough-ready="true"` on the host so the shared wireframe theme hides
 * the crisp CSS borders — outlines are never doubled (agent-native pattern).
 *
 * Deterministic: stroke seeds hash the frame id + element index, so the same
 * artifact draws the same sketch every render (no flicker on re-draw).
 */

import { useEffect, useRef } from "react";
import rough from "roughjs";

interface Props {
	frameId: string;
	/** Frame corner radius from the surface preset. */
	radius: number;
	/** Redraw key — the sanitized wireframe HTML currently rendered. */
	html: string;
}

/**
 * Elements whose borders rough.js replaces (mirrors the theme's hide list).
 * No bare `button` — the sanitizer strips form-control tags; wireframes carry
 * controls as `.wf-*`-classed structural elements.
 */
const ROUGH_TARGETS = [
	".wf-button", ".wf-input", ".wf-field", ".wf-select", ".wf-textarea",
	".wf-card", ".wf-box", ".wf-panel", ".wf-badge", ".wf-chip", ".wf-pill", ".wf-tag",
	".wf-list-item", ".wf-avatar", ".wf-image", ".wf-img", ".wf-media",
	".wf-alert", ".wf-banner", ".wf-checkbox", ".wf-radio", "hr",
].join(", ");

/** Draw budget — bounds a pathological artifact's per-draw cost. */
const MAX_ROUGH_ELEMENTS = 400;

/** FNV-1a — stable numeric seed per element so strokes do not flicker. */
function seedOf(key: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < key.length; i++) {
		h ^= key.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0) % 2147483646 + 1;
}

/** Rounded-rect path (rough.js rectangles have square corners). */
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
	const rr = Math.max(0, Math.min(r, w / 2, h / 2));
	if (rr === 0) return `M${x} ${y} L${x + w} ${y} L${x + w} ${y + h} L${x} ${y + h} Z`;
	return [
		`M${x + rr} ${y}`, `L${x + w - rr} ${y}`, `Q${x + w} ${y} ${x + w} ${y + rr}`,
		`L${x + w} ${y + h - rr}`, `Q${x + w} ${y + h} ${x + w - rr} ${y + h}`,
		`L${x + rr} ${y + h}`, `Q${x} ${y + h} ${x} ${y + h - rr}`,
		`L${x} ${y + rr}`, `Q${x} ${y} ${x + rr} ${y}`, "Z",
	].join(" ");
}

function strokeColorFor(el: Element, tokens: { sketch: string; accent: string; warn: string }): string {
	if (el.matches(".primary, .wf-primary")) return tokens.accent;
	if (el.matches(".wf-alert, .wf-banner, .wf-error")) return tokens.warn;
	return tokens.sketch;
}

export function RoughElementOverlay({ frameId, radius, html }: Props) {
	const svgRef = useRef<SVGSVGElement>(null);

	useEffect(() => {
		const svg = svgRef.current;
		const host = svg?.parentElement;
		if (!svg || !host) return;

		let disposed = false;
		const draw = () => {
			if (disposed) return;
			while (svg.firstChild) svg.removeChild(svg.firstChild);
			const hostRect = host.getBoundingClientRect();
			const hostW = host.offsetWidth;
			const hostH = host.offsetHeight;
			if (!hostRect.width || !hostW) {
				// Not measurable (jsdom, display:none, collapsed) — restore crisp
				// borders so outlines never vanish with no rough replacement.
				host.removeAttribute("data-rough-ready");
				return;
			}
			const scale = hostRect.width / hostW;

			const style = getComputedStyle(host);
			const tokens = {
				sketch: style.getPropertyValue("--wf-sketch").trim() || "#94a0ad",
				accent: style.getPropertyValue("--wf-accent").trim() || "#4c6ef5",
				warn: style.getPropertyValue("--wf-warn").trim() || "#d64545",
			};
			const rc = rough.svg(svg);
			const sketchOpts = { roughness: 1.05, bowing: 0.7, strokeWidth: 1.4, preserveVertices: true };

			// Frame outline: rounded rough rect, slightly inset, a touch bolder.
			svg.appendChild(rc.path(roundedRectPath(1.5, 1.5, hostW - 3, hostH - 3, radius), {
				...sketchOpts, strokeWidth: 2, roughness: 1.3, stroke: tokens.sketch, seed: seedOf(frameId),
			}));

			let i = 0;
			for (const el of host.querySelectorAll(ROUGH_TARGETS)) {
				i += 1;
				if (i > MAX_ROUGH_ELEMENTS) break;
				const r = el.getBoundingClientRect();
				if (!r.width || !r.height) continue;
				const x = (r.left - hostRect.left) / scale;
				const y = (r.top - hostRect.top) / scale;
				const w = r.width / scale;
				const h = r.height / scale;
				const seed = seedOf(`${frameId}:${i}`);
				const stroke = strokeColorFor(el, tokens);
				if (el.tagName === "HR") {
					svg.appendChild(rc.line(x, y + h / 2, x + w, y + h / 2, { ...sketchOpts, stroke, seed }));
					continue;
				}
				const elRadius = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
				svg.appendChild(rc.path(roundedRectPath(x, y, w, h, elRadius), { ...sketchOpts, stroke, seed }));
			}
			host.setAttribute("data-rough-ready", "true");
		};

		// Draw after layout; re-draw when the artboard resizes or a font load
		// completes (a hand-font swap reflows every measured box — the fixed-size
		// host means the ResizeObserver alone would miss it).
		const raf = requestAnimationFrame(draw);
		const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(draw) : null;
		ro?.observe(host);
		const onFonts = () => draw();
		document.fonts?.addEventListener?.("loadingdone", onFonts);
		document.fonts?.ready?.then(() => draw()).catch(() => undefined);

		return () => {
			disposed = true;
			cancelAnimationFrame(raf);
			ro?.disconnect();
			document.fonts?.removeEventListener?.("loadingdone", onFonts);
			host.removeAttribute("data-rough-ready");
		};
	}, [frameId, radius, html]);

	return (
		<svg
			ref={svgRef}
			className="vp-rough-overlay"
			aria-hidden="true"
			style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 3 }}
		/>
	);
}
