/**
 * Feedback batches: prepare stamps base revision/hash from the CURRENT artifact,
 * persists an immutable batch, and yields a repo-relative Copy Command. Batches
 * are write-once; a malformed batch id is rejected before any path join.
 */

import { describe, expect, it, afterEach } from "vitest";
import { prepareFeedback } from "../application/prepare-feedback.js";
import { writeBatch, readBatch, listBatchIds } from "../infrastructure/feedback-repository.js";
import { makeValidPlan } from "../__fixtures__/valid-plan.js";
import { createPlanDir, writePlanArtifact, cleanup } from "./plan-dir-helper.js";
import type { FeedbackBatch } from "../domain/feedback-schemas.js";

const dirs: string[] = [];
afterEach(() => cleanup(dirs));

function seed(): string {
	const planDir = createPlanDir(dirs);
	writePlanArtifact(planDir, makeValidPlan());
	return planDir;
}

describe("prepareFeedback", () => {
	it("persists an immutable batch with base revision/hash + a Copy Command", () => {
		const planDir = seed();
		const r = prepareFeedback(planDir, [{ type: "copy-change", intent: "shorten the CTA label" }]);
		expect(r.ok).toBe(true);
		expect(r.batchId).toMatch(/^feedback-\d{8,}-[a-z0-9]+$/);
		expect(r.copyCommand).toContain("/mk:visual-plan apply-feedback");
		expect(r.copyCommand).toContain(r.batchId as string);

		const batch = readBatch(planDir, r.batchId as string);
		expect(batch?.baseRevision).toBe(0);
		expect(batch?.baseHash).toMatch(/^[0-9a-f]{64}$/);
		expect(listBatchIds(planDir)).toContain(r.batchId);
	});

	it("rejects an empty operations list", () => {
		expect(prepareFeedback(seed(), []).ok).toBe(false);
	});
});

describe("feedback-repository", () => {
	const batch = (id: string): FeedbackBatch => ({
		schemaVersion: "visual-feedback/v1",
		id,
		planId: "sample-plan",
		baseRevision: 0,
		baseHash: "a".repeat(64),
		createdAt: "2026-07-12T00:00:00.000Z",
		operations: [{ type: "other", intent: "x" }],
		status: "open",
	});

	it("is write-once (refuses to overwrite an existing id)", () => {
		const planDir = createPlanDir(dirs);
		const b = batch("feedback-20260712000000-abcd");
		expect(writeBatch(planDir, b)).toBe(true);
		expect(writeBatch(planDir, b)).toBe(false); // immutable
	});

	it("rejects a path-traversal batch id before any join", () => {
		const planDir = createPlanDir(dirs);
		expect(() => readBatch(planDir, "../../etc/passwd")).toThrow();
	});
});
