// Phase 4 Slice B — `--html` and `--advice` are orthogonal.
//
// Locked decision 5: combining the two flags changes no activation, approval,
// validation, export or ownership of the visual pipeline. Most of that lives in prose,
// so most of this file asserts the live tree. One part does not: a returned correction
// used to be able to WRITE the visual artifact, and that is tested by reproducing it.
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EVIDENCE_INDEX_FILENAME, runAdvice } from "../../commands/advice.js";
import { isSupervisedSkill } from "../athena-supervision-protocol.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const read = (rel: string): string => readFileSync(join(REPO_ROOT, rel), "utf-8");
const flat = (rel: string): string => read(rel).replace(/\s+/g, " ");

const tempRoot = (): string => mkdtempSync(join(tmpdir(), "athena-html-"));

/** A Gate-1-approved visual artifact, shaped per `visual-plan-integration.md` §3. */
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
	it("refuses the visual artifact as a correction target, and leaves it untouched", async () => {
		// The reproduction. Before the fix this rewrote the artifact: `review.status`
		// flipped "approved" -> "superseded" (destroying the visual Gate-1 record), and
		// evidenceRevision / scopeRevision / verification / approvals were injected —
		// fields the visual schema does not define — leaving it broken against its own
		// pinned hash. A supervision event silently mutating the HTML pipeline's artifact
		// is exactly what "the flags are orthogonal" is supposed to make impossible.
		const root = tempRoot();
		const artifact = join(root, "tasks/plans/260726-demo/visual-plan/plan.json");
		mkdirSync(dirname(artifact), { recursive: true });
		writeFileSync(artifact, JSON.stringify(APPROVED_ARTIFACT, null, 2));

		await expect(returnWorkAgainst(root, "tasks/plans/260726-demo/visual-plan/plan.json")).rejects.toThrow(
			/must name a workflow-evidence\.json/,
		);

		expect(JSON.parse(readFileSync(artifact, "utf-8"))).toEqual(APPROVED_ARTIFACT);
	});

	it("refuses any non-index JSON file, not just the visual artifact", async () => {
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
		// the visual artifact next door. The name check must see the target, not the link.
		const root = tempRoot();
		const artifact = join(root, "tasks/plans/260726-demo/visual-plan/plan.json");
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

describe("the flags are parsed independently", () => {
	const step00 = flat(".claude/skills/plan-creator/step-00-scope-challenge.md");

	it("declares --html and --tdd composable and mode-independent", () => {
		// If either ever starts changing planning_mode, "orthogonal" stops being true and
		// the combined run diverges from the single-flag run before any visual work.
		expect(step00).toMatch(/set `tdd_mode = true`\. This flag is composable with any planning mode/);
		expect(step00).toMatch(/set `html_mode = true`\. This flag is composable with any planning mode and does NOT change the planning mode/);
	});

	it("keeps --html the single switch for the visual pipeline", () => {
		expect(step00).toMatch(/ONLY switch that turns on the structured visual-plan pipeline/);
		// Default off: a supervised run must not acquire visual work by being supervised.
		expect(step00).toMatch(/Default: `html_mode = false`/);
		expect(step00).toMatch(/plan-creator does NO visual work at all/);
	});

	it("reports every flag independently in the same scope line", () => {
		expect(step00).toMatch(/tdd: \{tdd_mode\} \| html: \{html_mode\}/);
	});

	it("keeps --advice detection separate from html_mode", () => {
		// Two independent paragraphs, not one branch: the advice paragraph must not read
		// html_mode and the html paragraph must not read the advice flag.
		const body = read(".claude/skills/plan-creator/step-00-scope-challenge.md");
		const htmlPara = /`--html` flag detection[\s\S]*?\n\n/.exec(body)?.[0] ?? "";
		expect(htmlPara).not.toMatch(/--advice|advice_mode/);
		const advicePara = /advice-checkpoints\.md[\s\S]{0,200}/.exec(body)?.[0] ?? "";
		expect(advicePara).not.toMatch(/html_mode/);
	});
});

describe("the combined run and the html-only run agree on the visual pipeline", () => {
	// The flow oracle. Each row is an ownership fact `--html` alone establishes; the
	// combined mode must not move any of them. Asserted against the live step files, so
	// a future edit that reroutes the pipeline under supervision fails here.
	const advice = flat(".claude/skills/plan-creator/references/advice-checkpoints.md");
	const integration = flat(".claude/skills/plan-creator/references/visual-plan-integration.md");
	const step08b = flat(".claude/skills/plan-creator/step-08b-html-render.md");

	it("keeps the Markdown plan as the source of truth", () => {
		expect(advice).toMatch(/Markdown plan stays the source of truth/);
		expect(integration).toMatch(/Markdown plan files remain source of truth|source hashes/);
	});

	it("keeps the export path and owner unchanged", () => {
		expect(step08b).toContain("mewkit visual-plan export");
		expect(step08b).toMatch(/\{plan_dir\}\/plan\.html/);
		expect(advice).toMatch(/still writes exactly `\{plan_dir\}\/plan\.html`/);
		expect(advice).toMatch(/still fail-open/);
	});

	it("keeps the visual approval with the human at the ordinary gate", () => {
		expect(advice).toMatch(/REVIEW fires before `step-07-gate`/);
		expect(advice).toMatch(/lands \*before\* the visual approval, never between it and the gate/);
		expect(step08b).toMatch(/Render only an APPROVED plan/);
	});

	it("routes a supervised correction through the existing rehash/re-approve loop", () => {
		// The one place the flags genuinely interact. Skipping rehash would present a
		// stale artifact beside a corrected plan at Gate 1.
		expect(advice).toMatch(/visual-plan rehash/);
		expect(advice).toMatch(/clears the prior visual approval/);
		expect(advice).toMatch(/stale artifact must never reach the gate/);
	});

	it("states that supervision touches no part of the visual artifact", () => {
		expect(advice).toMatch(/cannot approve the visual, edit the HTML, change its filename or path, open a browser/);
		// Structural, not promised — the claim is only as good as the tool grant.
		expect(advice).toMatch(/`Read, Grep, Glob` and nothing else/);
		expect(flat(".claude/agents/athena.md")).toMatch(/tools: Read, Grep, Glob/);
	});

	it("records the orthogonality in the canonical contract too", () => {
		const rule = flat(".claude/rules-conditional/advice-supervision-rules.md");
		expect(rule).toMatch(/Composing with `--html`/);
		expect(rule).toMatch(/Neither implies the other/);
		expect(rule).toMatch(/only write target is an existing `workflow-evidence\.json`/);
		expect(rule).toMatch(/run on the \*\*resolved\*\* path/);
	});
});

describe("the visual pipeline is not a supervision entry point", () => {
	it("mk:visual-plan cannot open a checkpoint", () => {
		expect(isSupervisedSkill("mk:visual-plan")).toBe(false);
	});

	it("mk:visual-plan is refused at the CLI and writes no dossier", async () => {
		const root = tempRoot();
		const run = "260726-1200-visual";
		await expect(
			runAdvice(root, { subcommand: "begin", run, skill: "mk:visual-plan", stage: "GUIDE", checkpoint: "g1" }),
		).rejects.toThrow(/does not expose --advice/);
		expect(existsSync(join(root, "tasks", "reports", `${run}-athena-supervision.md`))).toBe(false);
	});
});
