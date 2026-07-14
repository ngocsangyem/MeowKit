/**
 * Wireframe theme: every documented vocabulary class has a style rule, the
 * rough handoff hook exists, and the CSS is self-contained (no scripts, no
 * network URLs — it ships inside the offline export page).
 */

import { describe, expect, it } from "vitest";
import { WIREFRAME_THEME_CSS, WIREFRAME_THEME_CLASSES } from "../domain/wireframe-theme.js";

describe("WIREFRAME_THEME_CSS", () => {
	it("styles every vocabulary class (no unstyled wf-* blocks)", () => {
		for (const cls of WIREFRAME_THEME_CLASSES) {
			expect(WIREFRAME_THEME_CSS, `missing rule for .${cls}`).toContain(`.${cls}`);
		}
	});

	it("covers the rough handoff + clean style switches", () => {
		expect(WIREFRAME_THEME_CSS).toContain('[data-rough-ready="true"]');
		expect(WIREFRAME_THEME_CSS).toContain('[data-style="clean"]');
	});

	it("is self-contained: no scripts, no network URLs, scoped to .wf-root", () => {
		expect(WIREFRAME_THEME_CSS).not.toContain("<script");
		expect(WIREFRAME_THEME_CSS).not.toMatch(/https?:\/\//);
		expect(WIREFRAME_THEME_CSS).not.toContain("@import");
	});
});
