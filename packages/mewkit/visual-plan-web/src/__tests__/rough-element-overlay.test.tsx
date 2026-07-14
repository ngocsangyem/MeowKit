/**
 * Rough element overlay: renders a pointer-transparent SVG inside the artboard
 * body and — critically — does NOT stamp `data-rough-ready` when the host is
 * unmeasurable (jsdom reports zero rects), so crisp CSS borders are never
 * hidden before hand-drawn replacements exist.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RoughElementOverlay } from "../canvas/rough-element-overlay.js";

afterEach(cleanup);

describe("RoughElementOverlay", () => {
	it("renders a non-interactive overlay SVG", () => {
		const { container } = render(
			<div style={{ position: "relative" }}>
				<div className="wf-root"><button type="button">Go</button></div>
				<RoughElementOverlay frameId="f1" radius={14} html="<button>Go</button>" />
			</div>,
		);
		const svg = container.querySelector("svg.vp-rough-overlay");
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute("aria-hidden")).toBe("true");
	});

	it("keeps crisp borders when the host cannot be measured (no data-rough-ready)", async () => {
		const { container } = render(
			<div>
				<RoughElementOverlay frameId="f1" radius={14} html="<p>x</p>" />
			</div>,
		);
		// Effect draw is scheduled via rAF; flush a frame.
		await new Promise((r) => requestAnimationFrame(() => r(undefined)));
		const host = container.querySelector("svg.vp-rough-overlay")?.parentElement;
		expect(host?.getAttribute("data-rough-ready")).toBeNull();
	});
});
