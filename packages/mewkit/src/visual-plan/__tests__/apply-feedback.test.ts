/**
 * Apply-feedback loop (deterministic CLI mechanics) + receipt-aware approve:
 * fresh gate, stale stop after the artifact moves, write-once receipt (double-
 * apply refused), malformed batch-id rejected, and approve refusing an
 * unresolved receipt at the current revision.
 */

import { describe, expect, it, afterEach } from "vitest";
import { checkBatchFresh, recordResolution } from "../application/apply-feedback.js";
import { prepareFeedback } from "../application/prepare-feedback.js";
import { patchPlan } from "../application/patch-plan.js";
import { approvePlan } from "../application/approve.js";
import { makeValidPlan } from "../__fixtures__/valid-plan.js";
import { createPlanDir, stampFreshHashes, writePlanArtifact, cleanup } from "./plan-dir-helper.js";

const dirs: string[] = [];
afterEach(() => cleanup(dirs));

/** Seed a fresh-hashed valid plan + one open feedback batch. Returns { planDir, batchId }. */
function seedWithBatch(): { planDir: string; batchId: string } {
	const planDir = createPlanDir(dirs);
	const a = makeValidPlan();
	stampFreshHashes(planDir, a);
	writePlanArtifact(planDir, a);
	const r = prepareFeedback(planDir, [{ type: "copy-change", intent: "shorten CTA" }]);
	return { planDir, batchId: r.batchId as string };
}

describe("checkBatchFresh", () => {
	it("is fresh right after prepare, stale after the artifact moves", () => {
		const { planDir, batchId } = seedWithBatch();
		expect(checkBatchFresh(planDir, batchId).ok).toBe(true);
		patchPlan(planDir, { type: "reorder-frame", frameId: "fr-login", order: 3 }); // revision bumps
		const r = checkBatchFresh(planDir, batchId);
		expect(r.ok).toBe(false);
		expect(r.stale).toBe(true);
	});

	it("rejects a malformed batch id without throwing", () => {
		const { planDir } = seedWithBatch();
		expect(checkBatchFresh(planDir, "../../etc/passwd").ok).toBe(false);
	});
});

describe("recordResolution", () => {
	it("writes a receipt once and refuses a double-apply", () => {
		const { planDir, batchId } = seedWithBatch();
		const first = recordResolution(planDir, batchId, [{ index: 0, outcome: "applied" }]);
		expect(first.ok).toBe(true);
		expect(first.reopenCommand).toContain("visual-plan edit");
		expect(recordResolution(planDir, batchId, [{ index: 0, outcome: "applied" }]).ok).toBe(false); // double-apply
	});

	it("rejects malformed receipt entries", () => {
		const { planDir, batchId } = seedWithBatch();
		expect(recordResolution(planDir, batchId, [{ index: 0, outcome: "banana" }]).ok).toBe(false);
	});
});

describe("approve — receipt-aware refusal", () => {
	it("refuses to approve a revision whose receipt has an unresolved op", () => {
		const { planDir, batchId } = seedWithBatch();
		// Record a receipt with an unresolved op at the current revision (0).
		recordResolution(planDir, batchId, [{ index: 0, outcome: "unresolved", notes: "deferred" }]);
		const r = approvePlan(planDir, 0);
		expect(r.ok).toBe(false);
		expect(r.failedPreconditions.join(" ")).toMatch(/unresolved/i);
	});
});

describe("feedback lifecycle → approve gate", () => {
	it("prepare blocks approve (pending batch); resolving it unblocks the loop", () => {
		const { planDir, batchId } = seedWithBatch();
		// prepare added the batch to pendingFeedbackBatchIds → approve must refuse.
		const blocked = approvePlan(planDir, 0);
		expect(blocked.ok).toBe(false);
		expect(blocked.failedPreconditions.join(" ")).toMatch(/pending/i);

		// Resolving (all applied) clears the pending batch → approve now succeeds.
		recordResolution(planDir, batchId, [{ index: 0, outcome: "applied" }]);
		expect(approvePlan(planDir, 0).ok).toBe(true);
	});
});
