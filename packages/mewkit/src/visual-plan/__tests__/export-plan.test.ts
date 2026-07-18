/**
 * HTML export: self-contained (no external URLs), renders frames + coverage from
 * the approved artifact, and re-sanitizes wireframes so a scripted frame exports
 * inert.
 */

import { describe, expect, it, afterEach } from "vitest";
import { exportPlanHtml } from "../application/export-plan.js";
import { makeValidPlan } from "../__fixtures__/valid-plan.js";
import { createPlanDir, writePlanArtifact, cleanup } from "./plan-dir-helper.js";

const dirs: string[] = [];
afterEach(() => cleanup(dirs));

function seed(mutate?: (p: Record<string, unknown>) => void): string {
	const planDir = createPlanDir(dirs);
	const a = makeValidPlan();
	if (mutate) mutate(a);
	writePlanArtifact(planDir, a);
	return planDir;
}

describe("exportPlanHtml", () => {
	it("renders a self-contained page with frames + coverage and no external URLs", () => {
		const r = exportPlanHtml(seed());
		expect(r.ok).toBe(true);
		const html = r.html ?? "";
		expect(html).toContain("<!doctype html>");
		expect(html).toContain("Login"); // frame label
		expect(html).toContain("resolved"); // coverage summary
		expect(html).not.toMatch(/https?:\/\//); // no network references
		expect(html).not.toContain("<script"); // no scripts
	});

	it("re-sanitizes wireframes: a scripted frame exports inert", () => {
		const planDir = seed((p) => {
			(p.canvas as { frames: { wireframe: { html: string } }[] }).frames[0].wireframe.html =
				'<section class="wf-screen"><h1>X</h1><script>alert(1)</script></section>';
		});
		const html = exportPlanHtml(planDir).html ?? "";
		expect(html).not.toContain("<script>alert");
		expect(html).toContain("X"); // safe content kept
	});

	it("fails cleanly on a schema-invalid artifact", () => {
		const planDir = createPlanDir(dirs);
		writePlanArtifact(planDir, { schemaVersion: "nope" });
		expect(exportPlanHtml(planDir).ok).toBe(false);
	});
});
