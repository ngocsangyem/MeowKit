/**
 * Patch pipeline: each typed op applies; a stale If-Match stops before any
 * mutation; every accepted patch bumps revision + clears approval; an op with an
 * unknown target is rejected; a patch that would make the artifact invalid is
 * NOT written; sequential patches produce ordered revision increments.
 */

import { describe, expect, it, afterEach } from "vitest";
import { patchPlan } from "../application/patch-plan.js";
import { etagFromFile } from "../../local-web/etag.js";
import { artifactPath } from "../infrastructure/visual-plan-repository.js";
import { makeValidPlan } from "../__fixtures__/valid-plan.js";
import { createPlanDir, stampFreshHashes, writePlanArtifact, readPlanArtifact, cleanup } from "./plan-dir-helper.js";

const dirs: string[] = [];
afterEach(() => cleanup(dirs));

/** Seed a plan dir with a fresh-hashed artifact (optionally mutated first). */
function seed(mutate?: (p: Record<string, unknown>) => void): string {
	const planDir = createPlanDir(dirs);
	const a = makeValidPlan();
	// Two lanes + an editable wireframe field, so every op has a valid target.
	(a.canvas as { lanes: unknown[] }).lanes.push({ id: "lane-secondary", label: "Secondary" });
	(a.canvas as { frames: { wireframe: { html: string } }[] }).frames[0].wireframe.html =
		'<section class="wf-screen"><span class="wf-field-cta">Continue</span></section>';
	if (mutate) mutate(a);
	stampFreshHashes(planDir, a);
	writePlanArtifact(planDir, a);
	return planDir;
}

describe("patchPlan — op application", () => {
	it("move-frame-lane, reorder, connector-label, annotation edits, wireframe field all apply", () => {
		const planDir = seed();
		expect(patchPlan(planDir, { type: "move-frame-lane", frameId: "fr-login", laneId: "lane-secondary" }).status).toBe("ok");
		expect(patchPlan(planDir, { type: "reorder-frame", frameId: "fr-login", order: 5 }).status).toBe("ok");
		expect(patchPlan(planDir, { type: "update-connector-label", connectorId: "c-login-error", label: "bad creds" }).status).toBe("ok");
		expect(patchPlan(planDir, { type: "update-annotation", annotationId: "an-note-1", text: "New text" }).status).toBe("ok");
		const r = patchPlan(planDir, { type: "update-wireframe-field", frameId: "fr-login", fieldId: "cta", text: "Sign in now" });
		expect(r.status).toBe("ok");
		const art = readPlanArtifact(planDir);
		expect(JSON.stringify(art)).toContain("Sign in now");
		expect(((art.canvas as { frames: { id: string; laneId: string }[] }).frames.find((f) => f.id === "fr-login"))?.laneId).toBe("lane-secondary");
	});

	it("rejects an op with an unknown target (no write)", () => {
		const planDir = seed();
		const r = patchPlan(planDir, { type: "move-frame-lane", frameId: "fr-login", laneId: "lane-ghost" });
		expect(r.status).toBe("op-rejected");
		expect((readPlanArtifact(planDir).revision as number)).toBe(0);
	});

	it("does not persist a patch that would break validation", () => {
		const planDir = seed();
		const r = patchPlan(planDir, { type: "append-annotation", annotation: { id: "an-x", kind: "note", text: "x", targetId: "fr-ghost", placement: "top" } });
		expect(r.status).toBe("invalid-result");
		expect((readPlanArtifact(planDir).revision as number)).toBe(0); // not written
	});
});

describe("patchPlan — concurrency + approval", () => {
	it("stops a stale If-Match before mutating", () => {
		const planDir = seed();
		const r = patchPlan(planDir, { type: "reorder-frame", frameId: "fr-login", order: 9 }, "deadbeef".repeat(8));
		expect(r.status).toBe("stale");
		expect((readPlanArtifact(planDir).revision as number)).toBe(0);
	});

	it("accepts a matching If-Match and returns a new ETag", () => {
		const planDir = seed();
		const etag = etagFromFile(artifactPath(planDir))!;
		const r = patchPlan(planDir, { type: "reorder-frame", frameId: "fr-login", order: 3 }, etag);
		expect(r.status).toBe("ok");
		expect(r.etag).not.toBe(etag); // artifact changed → new ETag
	});

	it("bumps revision and clears approval on every accepted patch", () => {
		const planDir = seed((p) => {
			(p.review as Record<string, unknown>).status = "approved";
			(p.review as Record<string, unknown>).approvedRevision = 0;
		});
		patchPlan(planDir, { type: "reorder-frame", frameId: "fr-login", order: 1 });
		const review = readPlanArtifact(planDir).review as Record<string, unknown>;
		expect(review.status).toBe("draft");
		expect(review.approvedRevision).toBeNull();
	});

	it("two sequential patches produce ordered revision increments", () => {
		const planDir = seed();
		patchPlan(planDir, { type: "reorder-frame", frameId: "fr-login", order: 1 });
		patchPlan(planDir, { type: "reorder-frame", frameId: "fr-login", order: 2 });
		expect((readPlanArtifact(planDir).revision as number)).toBe(2);
	});
});
