/**
 * Render-time sanitizer (browser side, jsdom): the same adversarial corpus the
 * Phase-1 save-time sanitizer rejects must render INERT here — scripts, event
 * handlers, obfuscated schemes, iframes, form controls, and SVG all stripped —
 * while safe structural wireframes pass through clean. One engine, one config,
 * both sides.
 */

import { describe, expect, it } from "vitest";
import { sanitizeWireframe } from "../wireframe/sanitize.js";

const UNSAFE: Record<string, string> = {
	script: "<div>ok</div><script>window.__x=1</script>",
	"js href": '<a href="javascript:alert(1)">x</a>',
	"event handler": '<div onclick="steal()">hi</div>',
	iframe: '<iframe src="http://evil.test"></iframe>',
	form: '<form><input name="p"></form>',
	svg: "<svg><script>alert(1)</script></svg>",
	"img onerror": "<img src=x onerror=alert(1)>",
};

describe("sanitizeWireframe — inert on the adversarial corpus", () => {
	for (const [name, html] of Object.entries(UNSAFE)) {
		it(`neutralizes ${name}`, () => {
			const { html: out, clean } = sanitizeWireframe(html);
			expect(clean).toBe(false); // something was stripped
			expect(out.toLowerCase()).not.toContain("<script");
			expect(out.toLowerCase()).not.toContain("onclick");
			expect(out.toLowerCase()).not.toContain("javascript:");
			expect(out.toLowerCase()).not.toContain("<iframe");
			expect(out.toLowerCase()).not.toContain("<form");
		});
	}
});

describe("sanitizeWireframe — safe structural markup passes clean", () => {
	it("keeps a .wf-* wireframe unchanged", () => {
		const safe = '<section class="wf-screen"><h1>Sign in</h1><a href="#go" class="wf-button">Continue</a></section>';
		const { clean } = sanitizeWireframe(safe);
		expect(clean).toBe(true);
	});
});
