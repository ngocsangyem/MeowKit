/**
 * `approve` precondition matrix (single writer of review.status) and `rehash`
 * (the only sanctioned hash refresh, which clears any prior approval).
 */

import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { approvePlan } from "../application/approve.js";
import { rehashPlan } from "../application/rehash.js";
import { validatePlan } from "../application/validate-plan.js";
import { makeValidPlan } from "../__fixtures__/valid-plan.js";
import { createPlanDir, stampFreshHashes, writePlanArtifact, readPlanArtifact, cleanup } from "./plan-dir-helper.js";
import { readPlanState } from "../infrastructure/plan-state.js";

const dirs: string[] = [];
afterEach(() => cleanup(dirs));

function seed(mutate?: (p: Record<string, unknown>) => void): string {
	const planDir = createPlanDir(dirs);
	const artifact = makeValidPlan();
	if (mutate) mutate(artifact);
	stampFreshHashes(planDir, artifact);
	writePlanArtifact(planDir, artifact);
	return planDir;
}

describe("approve — success path", () => {
	it("stamps review + refreshes the plan-state pointer", () => {
		const planDir = seed();
		const r = approvePlan(planDir, 0);
		expect(r.ok).toBe(true);
		const art = readPlanArtifact(planDir).review as Record<string, unknown>;
		expect(art.status).toBe("approved");
		expect(art.approvedRevision).toBe(0);
		expect(typeof art.approvedAt).toBe("string");
		const visual = (readPlanState(planDir)?.visual ?? {}) as Record<string, unknown>;
		expect(visual.review_status).toBe("approved");
		expect(visual.revision).toBe(0);
	});
});

describe("approve — refusal matrix", () => {
	it("refuses a revision mismatch", () => {
		const r = approvePlan(seed(), 1);
		expect(r.ok).toBe(false);
		expect(r.failedPreconditions.join(" ")).toMatch(/revision/i);
	});

	it("refuses unresolved coverage", () => {
		const planDir = seed((p) => {
			(p.uiCoverage as { surfaces: { states: { frameIds: string[] }[] }[] }).surfaces[0].states[0].frameIds = [];
		});
		expect(approvePlan(planDir, 0).ok).toBe(false);
	});

	it("refuses a stale source hash", () => {
		const planDir = seed();
		fs.appendFileSync(path.join(planDir, "plan.md"), "\nedit\n");
		expect(approvePlan(planDir, 0).ok).toBe(false);
	});

	it("refuses when a feedback batch is pending", () => {
		const planDir = seed((p) => {
			(p.review as { pendingFeedbackBatchIds: string[] }).pendingFeedbackBatchIds = ["feedback-20260712-alpha"];
		});
		const r = approvePlan(planDir, 0);
		expect(r.ok).toBe(false);
		expect(r.failedPreconditions.join(" ")).toMatch(/pending/i);
	});
});

describe("rehash", () => {
	it("refreshes hashes and clears a prior approval", () => {
		const planDir = seed();
		expect(approvePlan(planDir, 0).ok).toBe(true);
		fs.appendFileSync(path.join(planDir, "plan.md"), "\nintentional edit\n");
		expect(validatePlan(planDir).ok).toBe(false); // stale now

		const r = rehashPlan(planDir);
		expect(r.ok).toBe(true);
		expect(r.clearedApproval).toBe(true);
		const review = readPlanArtifact(planDir).review as Record<string, unknown>;
		expect(review.status).toBe("draft");
		expect(review.approvedRevision).toBeNull();
		expect(validatePlan(planDir).ok).toBe(true); // fresh again
	});

	it("refuses to rehash a schema-invalid artifact", () => {
		const planDir = createPlanDir(dirs);
		fs.writeFileSync(path.join(planDir, "visual-plan", "plan.json"), JSON.stringify({ schemaVersion: "wrong" }));
		expect(rehashPlan(planDir).ok).toBe(false);
	});
});
