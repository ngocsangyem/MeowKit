/**
 * WireframeFrame renders the SANITIZED wireframe into a `.wf-root` scope. A
 * scripted wireframe must render with the safe text present and NO <script> in
 * the DOM (the render-time sanitizer is the sole boundary for live-DOM injection).
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { WireframeFrame } from "../wireframe/wireframe-frame.js";

describe("WireframeFrame", () => {
	it("scopes output under .wf-root and injects a safe wireframe", () => {
		const { container } = render(<WireframeFrame html='<section class="wf-screen"><h1>Hello</h1></section>' />);
		expect(container.querySelector(".wf-root")).not.toBeNull();
		expect(container.querySelector("h1")?.textContent).toBe("Hello");
	});

	it("renders a scripted wireframe inert (no <script> reaches the DOM)", () => {
		const { container } = render(<WireframeFrame html='<section class="wf-screen"><h1>Safe</h1><script>window.__pwn=1</script></section>' />);
		expect(container.querySelector("script")).toBeNull();
		expect(container.querySelector("h1")?.textContent).toBe("Safe");
		expect((window as unknown as { __pwn?: number }).__pwn).toBeUndefined();
	});
});
