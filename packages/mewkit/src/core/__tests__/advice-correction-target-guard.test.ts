// A returned correction may only rewrite a workflow-evidence index. Any other JSON file
// in the project, including another owner's approved artifact that carries its own
// `review.status`, is refused and left untouched.
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVIDENCE_INDEX_FILENAME, runAdvice } from "../../commands/advice.js";

const tempRoot = (): string => mkdtempSync(join(tmpdir(), "advice-target-"));

/** An approved artifact owned by another workflow, with its own top-level `review.status`. */
const APPROVED_ARTIFACT = {
	schemaVersion: "1.3",
	revision: 4,
	source: { planHash: "sha256:abc" },
	review: { status: "approved", approvedRevision: 4, approvedAt: "2026-07-26", pendingFeedbackBatchIds: [] },
};

/** Open a REVIEW checkpoint and return work, pointing the correction at `evidence`. */
async function returnWorkAgainst(root: string, evidence: string): Promise<void> {
	const run = "260726-1200-plan";
	await runAdvice(root, { subcommand: "begin", run, skill: "mk:plan-creator", stage: "REVIEW", checkpoint: "rev1" });
	await runAdvice(root, {
		subcommand: "commit",
		run,
		checkpoint: "rev1",
		disposition: "RETURN_TO_EXECUTOR",
		outcome: "adopted",
		reason: "test",
		slug: "demo",
		correction: "fix the plan",
		correctionKind: "scope",
		evidence,
	});
}

describe("a correction cannot write another owner's artifact", () => {
	it("refuses another owner's approved artifact as a correction target, and leaves it untouched", async () => {
		// Before the guard, a correction spread its fields into any JSON file: `review.status`
		// flipped "approved" -> "superseded" and evidence fields were injected into a schema
		// that does not define them.
		const root = tempRoot();
		const artifact = join(root, "tasks/plans/260726-demo/artifact.json");
		mkdirSync(dirname(artifact), { recursive: true });
		writeFileSync(artifact, JSON.stringify(APPROVED_ARTIFACT, null, 2));

		await expect(returnWorkAgainst(root, "tasks/plans/260726-demo/artifact.json")).rejects.toThrow(
			/must name a workflow-evidence\.json/,
		);

		expect(JSON.parse(readFileSync(artifact, "utf-8"))).toEqual(APPROVED_ARTIFACT);
	});

	it("refuses any non-index JSON file", async () => {
		const root = tempRoot();
		for (const rel of ["package.json", "tasks/plans/x/.plan-state.json", "tasks/reports/notes.json"]) {
			const abs = join(root, rel);
			mkdirSync(dirname(abs), { recursive: true });
			writeFileSync(abs, JSON.stringify({ some: "object" }));
			await expect(returnWorkAgainst(root, rel), rel).rejects.toThrow(/must name a workflow-evidence\.json/);
		}
	});

	it("refuses a correctly-named symlink that escapes the project", async () => {
		// The name check alone answered a question about the caller's STRING, not about
		// the file that would be opened — and `readFileSync` follows links. A symlink
		// named workflow-evidence.json inside the repo, pointing outside it, satisfied
		// every textual check; its contents were merged into the correction and written
		// back inside the repo. Project boundary defeated by one indirection.
		const root = tempRoot();
		const outside = join(mkdtempSync(join(tmpdir(), "athena-outside-")), "secrets.json");
		writeFileSync(outside, JSON.stringify({ apiKey: "sk-not-a-real-key", evidenceRevision: 1 }));

		const link = join(root, `tasks/plans/x/reports/evidence/${EVIDENCE_INDEX_FILENAME}`);
		mkdirSync(dirname(link), { recursive: true });
		symlinkSync(outside, link);

		await expect(returnWorkAgainst(root, `tasks/plans/x/reports/evidence/${EVIDENCE_INDEX_FILENAME}`)).rejects.toThrow(
			/must stay inside the project/,
		);

		// Nothing leaked in, and the external file is untouched.
		expect(JSON.parse(readFileSync(outside, "utf-8"))).toEqual({ apiKey: "sk-not-a-real-key", evidenceRevision: 1 });
		expect(lstatSync(link).isSymbolicLink()).toBe(true);
	});

	it("refuses a symlink whose real target is not an evidence index", async () => {
		// The in-project half of the same indirection: a correctly-named link pointing at
		// another owner's artifact next door. The name check must see the target, not the link.
		const root = tempRoot();
		const artifact = join(root, "tasks/plans/260726-demo/artifact.json");
		mkdirSync(dirname(artifact), { recursive: true });
		writeFileSync(artifact, JSON.stringify(APPROVED_ARTIFACT, null, 2));

		const link = join(root, `tasks/plans/260726-demo/reports/evidence/${EVIDENCE_INDEX_FILENAME}`);
		mkdirSync(dirname(link), { recursive: true });
		symlinkSync(artifact, link);

		await expect(
			returnWorkAgainst(root, `tasks/plans/260726-demo/reports/evidence/${EVIDENCE_INDEX_FILENAME}`),
		).rejects.toThrow(/must name a workflow-evidence\.json/);

		expect(JSON.parse(readFileSync(artifact, "utf-8"))).toEqual(APPROVED_ARTIFACT);
	});

	it("refuses an evidence path that does not exist, without creating one", async () => {
		// A correction supersedes recorded evidence; it never brings an index into being.
		const root = tempRoot();
		await expect(returnWorkAgainst(root, `tasks/plans/x/reports/evidence/${EVIDENCE_INDEX_FILENAME}`)).rejects.toThrow(
			/evidence file not found/,
		);
		expect(existsSync(join(root, "tasks/plans/x/reports/evidence", EVIDENCE_INDEX_FILENAME))).toBe(false);
	});

	it("still accepts the evidence index under every root it is written to", async () => {
		// The guard must not break a caller. These are the roots the index is written
		// under across the harness; all share the one filename, which is why the name is
		// the check rather than any single path.
		const roots = [
			`tasks/plans/260726-demo/reports/evidence/${EVIDENCE_INDEX_FILENAME}`,
			`.claude/session-state/evidence/260726-1200-demo/${EVIDENCE_INDEX_FILENAME}`,
			`.codex/session-state/evidence/260726-1200-demo/${EVIDENCE_INDEX_FILENAME}`,
			`.meowkit/state/evidence/260726-1200-demo/${EVIDENCE_INDEX_FILENAME}`,
		];
		for (const rel of roots) {
			const root = tempRoot();
			const abs = join(root, rel);
			mkdirSync(dirname(abs), { recursive: true });
			writeFileSync(abs, JSON.stringify({ evidenceRevision: 1, approvals: { gate1: "approved" } }, null, 2));

			await returnWorkAgainst(root, rel);

			const after = JSON.parse(readFileSync(abs, "utf-8"));
			expect(after.evidenceRevision, rel).toBe(2);
			expect(after.review.status, rel).toBe("superseded");
			// A scope correction returns Gate 1 to the human; it never grants one.
			expect(after.approvals.gate1, rel).toBe("required");
		}
	});
});
