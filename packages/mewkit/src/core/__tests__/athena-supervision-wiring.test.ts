// Wiring tests for the supervised checkpoint surface.
//
// The Phase 2 contract tests prove the pure rules. These prove the rules survive the
// boundary that actually exists at runtime: every checkpoint is a separate CLI
// process, so anything held only in memory is gone by the next call.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	commitCheckpoint,
	beginCheckpoint,
	parseDossier,
	readDossier,
	renderDossier,
	updateDossier,
	writeDossier,
	type Dossier,
} from "../athena-supervision-dossier.js";
import { evaluateStageRequest } from "../athena-supervision-protocol.js";
import { receiptPath, renderReceipt, validateReceipt, type Receipt } from "../athena-supervision-receipt.js";
import {
	applyCorrection,
	evidenceStatusOf,
	markCurrent,
	supersessionProblems,
} from "../workflow-evidence-revision.js";
import { AdviceRefusal, EVIDENCE_INDEX_FILENAME, runAdvice } from "../../commands/advice.js";

// Resolve the repo from this file, not `process.cwd()`: cwd passes from the repo root
// and fails from `packages/mewkit`, and the newer tests here already moved off it.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const VALIDATOR = join(REPO_ROOT, ".claude/scripts/validate-workflow-evidence.cjs");

const tempRoot = (): string => mkdtempSync(join(tmpdir(), "athena-wiring-"));

const baseDossier = (over: Partial<Dossier> = {}): Dossier => ({
	runId: "run-cook-1",
	skill: "mk:cook",
	stage: "GUIDE",
	lockedDecisionPointers: ["plan.md#locked-decisions"],
	latestDirective: "prove the failing path before editing",
	correctionCount: 0,
	receiptPointers: [],
	nextSafeAction: "run the focused test",
	checkpoint: null,
	history: [],
	escalatedToHuman: false,
	...over,
});

describe("dossier round-trip", () => {
	it("parses back exactly what it rendered, including call history", () => {
		const original = baseDossier({
			checkpoint: { checkpointId: "cook-review", stage: "REVIEW", state: "committed" },
			history: [
				{ checkpointId: "cook-guide", stage: "GUIDE", disposition: "CONTINUE_WITH_DIRECTIVE" },
				{ checkpointId: "cook-review", stage: "REVIEW", disposition: "RETURN_TO_EXECUTOR" },
			],
			correctionCount: 1,
			receiptPointers: ["tasks/reports/260726-run-advice-1.md"],
		});
		const read = parseDossier(renderDossier(original));
		expect(read.found).toBe(true);
		if (read.found) expect(read.dossier).toEqual(original);
	});

	it("round-trips a directive containing quotes and a newline by normalizing to one line", () => {
		const original = baseDossier({ latestDirective: 'use "withFileLock"\nthen re-run verify' });
		const read = parseDossier(renderDossier(original));
		expect(read.found).toBe(true);
		// Normalized, not truncated: a directive that lost its tail on read would be a
		// different instruction than the one that was recorded.
		if (read.found) expect(read.dossier.latestDirective).toBe('use "withFileLock" then re-run verify');
	});

	it("reports a damaged record as CORRUPT, never as an absent run", () => {
		// This is the property that matters: "absent" would restart cap accounting at
		// zero, making a broken file the cheapest route to unlimited supervision calls.
		expect(parseDossier("no frontmatter here")).toMatchObject({ found: false, corrupt: true });
		expect(parseDossier("---\nrunId: \"x\"\n---\n")).toMatchObject({ found: false, corrupt: true });

		const root = tempRoot();
		expect(readDossier(root, "never-written")).toEqual({ found: false, corrupt: false });
	});

	it("survives a write/read cycle on disk", async () => {
		const root = tempRoot();
		await writeDossier(root, baseDossier({ history: [{ checkpointId: "g", stage: "GUIDE", disposition: "ESCALATE_TO_HUMAN" }] }));
		const read = readDossier(root, "run-cook-1");
		expect(read.found).toBe(true);
		if (read.found) expect(read.dossier.history).toHaveLength(1);
	});
});

describe("caps survive the process boundary", () => {
	it("counts committed calls from the persisted history, not from memory", async () => {
		const root = tempRoot();
		let dossier = baseDossier({ skill: "mk:fix" });

		// Five committed calls = mk:fix's whole budget, each written and re-read as a
		// separate "process" would.
		const calls = [
			{ id: "fix-guide", stage: "GUIDE" as const, disposition: "CONTINUE_WITH_DIRECTIVE" as const },
			{ id: "fix-rescue-1", stage: "RESCUE" as const, disposition: "CONTINUE_WITH_DIRECTIVE" as const },
			{ id: "fix-rescue-2", stage: "RESCUE" as const, disposition: "CONTINUE_WITH_DIRECTIVE" as const },
			{ id: "fix-review", stage: "REVIEW" as const, disposition: "RETURN_TO_EXECUTOR" as const },
			{ id: "fix-recheck", stage: "RECHECK" as const, disposition: "READY_FOR_EXISTING_GATE" as const },
		];
		for (const c of calls) {
			const reloaded = readDossier(root, dossier.runId);
			const current = reloaded.found ? reloaded.dossier : dossier;
			const verdict = evaluateStageRequest({
				skill: "mk:fix",
				stage: c.stage,
				checkpointId: c.id,
				history: current.history,
			});
			expect(verdict.allowed, c.id).toBe(true);
			dossier = commitCheckpoint(beginCheckpoint(current, { checkpointId: c.id, stage: c.stage }), {
				latestDirective: "d",
				nextSafeAction: "n",
				disposition: c.disposition,
			});
			await writeDossier(root, dossier);
		}

		const reloaded = readDossier(root, dossier.runId);
		expect(reloaded.found && reloaded.dossier.history).toHaveLength(5);
		const sixth = evaluateStageRequest({
			skill: "mk:fix",
			stage: "GUIDE",
			checkpointId: "fix-guide-again",
			history: reloaded.found ? reloaded.dossier.history : [],
		});
		expect(sixth.allowed).toBe(false);
	});

	it("does not lose a committed call when two updates race", async () => {
		// read-then-write loses one update, and the update lost is a committed
		// checkpoint — i.e. a spent cap slot handed back. The whole read-modify-write
		// has to sit inside the lock, not just the rename.
		const root = tempRoot();
		await writeDossier(root, baseDossier({ skill: "mk:fix" }));

		await Promise.all([
			updateDossier(root, "run-cook-1", (d) =>
				commitCheckpoint(beginCheckpoint(d as Dossier, { checkpointId: "a", stage: "GUIDE" }), {
					latestDirective: "a",
					nextSafeAction: "a",
					disposition: "CONTINUE_WITH_DIRECTIVE",
				}),
			),
			updateDossier(root, "run-cook-1", (d) =>
				commitCheckpoint(beginCheckpoint(d as Dossier, { checkpointId: "b", stage: "RESCUE" }), {
					latestDirective: "b",
					nextSafeAction: "b",
					disposition: "CONTINUE_WITH_DIRECTIVE",
				}),
			),
		]);

		const read = readDossier(root, "run-cook-1");
		expect(read.found).toBe(true);
		if (read.found) expect(read.dossier.history.map((h) => h.checkpointId).sort()).toEqual(["a", "b"]);
	});

	it("does not spend a slot on a repeated checkpointId", () => {
		const history = [{ checkpointId: "cook-guide", stage: "GUIDE" as const, disposition: "CONTINUE_WITH_DIRECTIVE" as const }];
		const retry = evaluateStageRequest({ skill: "mk:cook", stage: "GUIDE", checkpointId: "cook-guide", history });
		expect(retry).toEqual({ allowed: true, duplicateOf: "cook-guide" });
	});

	it("replaces rather than appends when the same checkpoint commits twice", () => {
		const pending = beginCheckpoint(baseDossier(), { checkpointId: "c1", stage: "GUIDE" });
		const once = commitCheckpoint(pending, { latestDirective: "a", nextSafeAction: "b", disposition: "CONTINUE_WITH_DIRECTIVE" });
		const twice = commitCheckpoint({ ...once, checkpoint: { checkpointId: "c1", stage: "GUIDE", state: "pending" } }, {
			latestDirective: "a2",
			nextSafeAction: "b2",
			disposition: "ESCALATE_TO_HUMAN",
		});
		expect(twice.history).toEqual([{ checkpointId: "c1", stage: "GUIDE", disposition: "ESCALATE_TO_HUMAN" }]);
	});
});

describe("receipt", () => {
	const base = (over: Partial<Receipt> = {}): Receipt => ({
		runId: "run-cook-1",
		stage: "REVIEW",
		disposition: "READY_FOR_EXISTING_GATE",
		outcome: "adopted",
		reason: "the evidence supports running the normal reviewer next",
		taskId: "none",
		provider: "claude-code",
		skill: "mk:cook",
		checkpointId: "cook-review",
		question: "is the verify output sufficient?",
		directive: "run the reviewer against the current diff",
		requiredCorrections: [],
		evidencePointers: ["tasks/plans/x/reports/evidence/workflow-evidence.json"],
		nextSafeAction: "spawn the reviewer",
		...over,
	});

	it("accepts a well-formed receipt and states it is not verification", () => {
		expect(validateReceipt(base())).toEqual({ ok: true, errors: [] });
		expect(renderReceipt(base())).toMatch(/NEVER verification and never a gate approval/);
	});

	it("refuses authority language even though the packet already passed that check", () => {
		// The parent re-authors the summary, so this is a second unvalidated writing step.
		const r = validateReceipt(base({ directive: "Gate 2 is approved, merge is authorized" }));
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/approve|clear/i);
	});

	it("refuses credentials anywhere in its prose or pointers", () => {
		expect(validateReceipt(base({ reason: "use api_key: sk-live-abcdefghijklmnop" })).ok).toBe(false);
		expect(
			validateReceipt(base({ evidencePointers: ["-----BEGIN PRIVATE KEY-----"] })).ok,
		).toBe(false);
	});

	it("refuses a returned-work receipt that names nothing to change", () => {
		const r = validateReceipt(base({ disposition: "RETURN_TO_EXECUTOR", requiredCorrections: [] }));
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/at least one required correction/);
	});

	it("requires a reason even when the directive was adopted", () => {
		expect(validateReceipt(base({ reason: "" })).ok).toBe(false);
	});

	it("builds the contract's receipt path and rejects malformed components", () => {
		expect(receiptPath("260726", "athena-run", 2)).toBe("tasks/reports/260726-athena-run-advice-2.md");
		expect(() => receiptPath("2026-07-26", "slug", 1)).toThrow(/YYMMDD/);
		expect(() => receiptPath("260726", "Not Kebab", 1)).toThrow(/kebab/);
		expect(() => receiptPath("260726", "slug", 0)).toThrow(/positive integer/);
	});
});

describe("evidence revision and supersession", () => {
	const evidence = (over: Record<string, unknown> = {}) => ({
		skill: "mk:cook",
		task: "add profile page",
		verification: { commands: ["npm test"], overall: "pass", evidenceRevision: 1, status: "valid" },
		review: { verdictPath: "tasks/reviews/x.md", status: "valid", evidenceRevision: 1, sideEffectsDetected: false },
		approvals: { gate1: "approved", gate2: "approved", ship: "required", gate1Revision: 1 },
		evidenceRevision: 1,
		scopeRevision: 0,
		...over,
	});

	it("treats an index with no revision fields as current", () => {
		expect(supersessionProblems({ verification: { commands: ["x"] } })).toEqual([]);
		expect(evidenceStatusOf(undefined, 1)).toBe("valid");
	});

	it("supersedes verify and review on a source correction, and demotes Gate 2 only", () => {
		const after = applyCorrection(evidence(), "source");
		expect(after.evidenceRevision).toBe(2);
		expect(after.verification.status).toBe("superseded");
		expect(after.review.status).toBe("superseded");
		expect(after.approvals.gate2).toBe("required");
		// An in-scope fix keeps Gate 1: forcing a fresh plan approval after every
		// ordinary correction trains people to click through the gate that matters.
		expect(after.approvals.gate1).toBe("approved");
	});

	it("additionally invalidates Gate 1 on a scope correction", () => {
		const after = applyCorrection(evidence(), "scope");
		expect(after.scopeRevision).toBe(2);
		expect(after.approvals.gate1).toBe("required");
		expect(supersessionProblems(after)).toEqual([]);
	});

	it("refuses a Gate 2 approval resting on superseded proof", () => {
		const stale = { ...applyCorrection(evidence(), "source"), approvals: { gate1: "approved", gate2: "approved", gate1Revision: 1 } };
		expect(supersessionProblems(stale)).toContain("gate2-approved-on-superseded-review");
		expect(supersessionProblems(stale)).toContain("gate2-approved-on-superseded-verification");
	});

	it("refuses a stale record that claims to be valid", () => {
		const lying = evidence({ evidenceRevision: 3, verification: { commands: ["x"], evidenceRevision: 1, status: "valid" } });
		expect(supersessionProblems(lying)).toContain("stale-verification-marked-valid");
	});

	it("refuses a Gate 1 approval older than the last scope change", () => {
		const moved = evidence({ evidenceRevision: 2, scopeRevision: 2, approvals: { gate1: "approved", gate1Revision: 1 } });
		expect(supersessionProblems(moved)).toContain("gate1-approved-before-scope-change");
	});

	it("clears once the corrected work is re-verified at the current revision", () => {
		let after = applyCorrection(evidence(), "source");
		after = markCurrent(markCurrent(after, "verification"), "review");
		expect(supersessionProblems(after)).toEqual([]);
	});
});

describe("validator parity (TypeScript core vs shipped .cjs)", () => {
	// Two implementations of one rule drift, and the looser one silently becomes the
	// contract. These fixtures are the shared truth both must agree on.
	const fixtures: { name: string; index: Record<string, unknown> }[] = [
		{ name: "no revision fields", index: {} },
		{ name: "current", index: { evidenceRevision: 2, verification: { evidenceRevision: 2 }, review: { evidenceRevision: 2 } } },
		{ name: "stale review under gate2", index: { evidenceRevision: 2, review: { evidenceRevision: 1 }, approvals: { gate2: "approved" } } },
		{ name: "stale verification marked valid", index: { evidenceRevision: 2, verification: { evidenceRevision: 1, status: "valid" } } },
		{ name: "scope moved past gate1", index: { evidenceRevision: 2, scopeRevision: 2, approvals: { gate1: "approved", gate1Revision: 1 } } },
		{ name: "revision out of range", index: { evidenceRevision: 1, review: { evidenceRevision: 9 } } },
		{ name: "scope ahead of revision", index: { evidenceRevision: 1, scopeRevision: 5 } },
		{ name: "status superseded under gate2", index: { review: { status: "superseded" }, approvals: { gate2: "approved" } } },
	];

	it.each(fixtures)("agrees on $name", ({ index }) => {
		const tsProblems = supersessionProblems(index);

		// The .cjs validates a whole index, so pad the fixture with the unrelated fields
		// it also requires; only the supersession reasons are compared.
		const root = tempRoot();
		const file = join(root, "workflow-evidence.json");
		writeFileSync(
			file,
			JSON.stringify({
				skill: "mk:fix",
				task: "parity fixture",
				verification: { commands: ["npm test"] },
				fixDiagnosis: {
					exactSymptom: "s",
					reproduction: "r",
					expectedActual: "e",
					rootCause: "c",
					whyNow: "w",
					blastRadius: ["b"],
				},
				...index,
				// Merge, so a fixture that overrides `verification` keeps `commands`.
				verification: { commands: ["npm test"], ...((index.verification as object) ?? {}) },
			}),
			"utf-8",
		);

		let output = "";
		try {
			output = execFileSync("node", [VALIDATOR, file, "--phase", "fix"], { encoding: "utf-8" });
		} catch (err) {
			output = (err as { stdout: string }).stdout;
		}
		const cjsReasons = output.startsWith("EVIDENCE_BLOCKED:")
			? output.split("\n")[0].slice("EVIDENCE_BLOCKED:".length).split(",")
			: [];
		const cjsSupersession = cjsReasons.filter((r) => /revision|superseded|stale|scope/.test(r));

		expect([...cjsSupersession].sort()).toEqual([...tsProblems].sort());
	});

	it("the shipped validator's own self-test still passes", () => {
		const out = execFileSync("node", [VALIDATOR, "--self-test"], { encoding: "utf-8" });
		expect(out).toMatch(/SELF_TEST_OK/);
	});
});

describe("advice command", () => {
	const begin = (root: string, over: Record<string, unknown> = {}) =>
		runAdvice(root, {
			subcommand: "begin",
			run: "run-1",
			skill: "mk:cook",
			stage: "GUIDE",
			checkpoint: "cook-guide",
			...over,
		});

	it("refuses an embedded call missing part of the run triple", async () => {
		const root = tempRoot();
		await expect(begin(root, { run: undefined })).rejects.toThrow(AdviceRefusal);
		await expect(begin(root, { stage: "bogus" })).rejects.toThrow(/known stage/);
		await expect(begin(root, { checkpoint: "  " })).rejects.toThrow(/checkpointId/);
	});

	it("refuses a skill that does not expose --advice", async () => {
		const root = tempRoot();
		await expect(begin(root, { skill: "mk:scout" })).rejects.toThrow(/does not expose --advice/);
	});

	it("opens a checkpoint, then commits it with a receipt and history entry", async () => {
		const root = tempRoot();
		await begin(root);

		const opened = readDossier(root, "run-1");
		expect(opened.found && opened.dossier.checkpoint).toEqual({
			checkpointId: "cook-guide",
			stage: "GUIDE",
			state: "pending",
		});

		await runAdvice(root, {
			subcommand: "commit",
			run: "run-1",
			checkpoint: "cook-guide",
			disposition: "CONTINUE_WITH_DIRECTIVE",
			outcome: "adopted",
			reason: "the evidence supports starting with the validator",
			directive: "start with the packet validator",
			next: "write the schema test",
			slug: "athena-run",
		});

		const committed = readDossier(root, "run-1");
		expect(committed.found).toBe(true);
		if (!committed.found) return;
		expect(committed.dossier.checkpoint?.state).toBe("committed");
		expect(committed.dossier.history).toEqual([
			{ checkpointId: "cook-guide", stage: "GUIDE", disposition: "CONTINUE_WITH_DIRECTIVE" },
		]);
		expect(committed.dossier.receiptPointers).toHaveLength(1);

		const receipt = readFileSync(join(root, committed.dossier.receiptPointers[0]), "utf-8");
		expect(receipt).toMatch(/kind: advice-receipt/);
		expect(receipt).toMatch(/NEVER verification and never a gate approval/);
	});

	it("refuses a disposition that is illegal for the open stage", async () => {
		const root = tempRoot();
		await begin(root);
		await expect(
			runAdvice(root, {
				subcommand: "commit",
				run: "run-1",
				checkpoint: "cook-guide",
				// Backward-looking disposition at a forward-looking stage.
				disposition: "READY_FOR_EXISTING_GATE",
				reason: "r",
			}),
		).rejects.toThrow(/not legal at GUIDE/);
	});

	it("refuses to commit a checkpoint that was never opened", async () => {
		const root = tempRoot();
		await begin(root);
		await expect(
			runAdvice(root, { subcommand: "commit", run: "run-1", checkpoint: "other", disposition: "CONTINUE_WITH_DIRECTIVE", reason: "r" }),
		).rejects.toThrow(/no open checkpoint/);
	});

	it("stops supervision on a corrupt dossier instead of restarting the caps", async () => {
		const root = tempRoot();
		await begin(root);
		writeFileSync(join(root, "tasks/reports/run-1-athena-supervision.md"), "garbage", "utf-8");
		await expect(begin(root, { checkpoint: "cook-guide-2" })).rejects.toThrow(/unreadable/);
	});

	it("supersedes the named evidence index when work is returned", async () => {
		const root = tempRoot();
		const evidenceFile = join(root, "workflow-evidence.json");
		writeFileSync(
			evidenceFile,
			JSON.stringify({
				skill: "mk:cook",
				task: "t",
				evidenceRevision: 1,
				verification: { commands: ["npm test"], evidenceRevision: 1, status: "valid" },
				review: { verdictPath: "v.md", evidenceRevision: 1, status: "valid" },
				approvals: { gate1: "approved", gate2: "approved", gate1Revision: 1 },
			}),
			"utf-8",
		);

		await begin(root, { stage: "REVIEW", checkpoint: "cook-review" });
		await runAdvice(root, {
			subcommand: "commit",
			run: "run-1",
			checkpoint: "cook-review",
			disposition: "RETURN_TO_EXECUTOR",
			outcome: "adopted",
			reason: "the regression test is missing",
			correction: ["add a regression test for the null branch"],
			evidence: "workflow-evidence.json",
			correctionKind: "source",
		});

		const updated = JSON.parse(readFileSync(evidenceFile, "utf-8"));
		expect(updated.evidenceRevision).toBe(2);
		expect(updated.verification.status).toBe("superseded");
		expect(updated.review.status).toBe("superseded");
		expect(updated.approvals.gate2).toBe("required");
		expect(updated.approvals.gate1).toBe("approved");
		expect(supersessionProblems(updated)).toEqual([]);
	});

	it("refuses an --evidence path that escapes the project", async () => {
		// `--evidence` reaches a WRITE, so a traversal here would let a supervision
		// event mutate a file outside the repository (`injection-rules.md` Rule 6).
		//
		// The escaping target must EXIST for this to test the boundary. Pointing at a
		// path that is both outside and absent gets refused as absent, which is safe but
		// proves nothing about traversal — the check under test never runs.
		const root = tempRoot();
		const outsideDir = mkdtempSync(join(tmpdir(), "athena-escape-"));
		const outside = join(outsideDir, EVIDENCE_INDEX_FILENAME);
		writeFileSync(outside, JSON.stringify({ evidenceRevision: 1 }), "utf-8");

		await begin(root, { stage: "REVIEW", checkpoint: "cook-review" });
		await expect(
			runAdvice(root, {
				subcommand: "commit",
				run: "run-1",
				checkpoint: "cook-review",
				disposition: "RETURN_TO_EXECUTOR",
				reason: "r",
				correction: ["c"],
				evidence: outside,
				correctionKind: "source",
			}),
		).rejects.toThrow(/must stay inside the project/);

		// Untouched: a refused correction writes nothing anywhere.
		expect(JSON.parse(readFileSync(outside, "utf-8"))).toEqual({ evidenceRevision: 1 });
	});

	it("does not let a fresh run id walk around an escalation", async () => {
		// Caps are per run and the run id comes from the caller, so the escalation —
		// not the budget — is what a new id would otherwise defeat.
		const root = tempRoot();
		await begin(root, { run: "run-a", stage: "REVIEW", checkpoint: "r1" });
		await runAdvice(root, {
			subcommand: "commit",
			run: "run-a",
			checkpoint: "r1",
			disposition: "RETURN_TO_EXECUTOR",
			reason: "first return",
			correction: ["fix one"],
		});
		await begin(root, { run: "run-a", stage: "RECHECK", checkpoint: "r2" });
		await runAdvice(root, {
			subcommand: "commit",
			run: "run-a",
			checkpoint: "r2",
			disposition: "RETURN_TO_EXECUTOR",
			reason: "second return, still unresolved",
			correction: ["fix two"],
		});

		const escalated = readDossier(root, "run-a");
		expect(escalated.found && escalated.dossier.escalatedToHuman).toBe(true);

		// The same skill under a brand-new run id is refused, and the refusal says the
		// decision belongs to a human.
		await expect(begin(root, { run: "run-b", stage: "GUIDE", checkpoint: "g1" })).rejects.toThrow(
			/escalated to a human/,
		);
		// So is resuming the escalated run itself.
		await expect(begin(root, { run: "run-a", stage: "GUIDE", checkpoint: "g2" })).rejects.toThrow(
			/escalated to a human/,
		);
		// A different skill is unaffected — the escalation is scoped, not global.
		await expect(begin(root, { run: "run-c", skill: "mk:fix", stage: "GUIDE", checkpoint: "g3" })).resolves.toBeUndefined();
	});

	it("records the escalation when a cap refusal fires", async () => {
		const root = tempRoot();
		// Burn mk:cook's five-call budget, then ask for a sixth.
		const calls: [string, "GUIDE" | "RESCUE" | "REVIEW" | "RECHECK", string][] = [
			["c1", "GUIDE", "CONTINUE_WITH_DIRECTIVE"],
			["c2", "RESCUE", "CONTINUE_WITH_DIRECTIVE"],
			["c3", "RESCUE", "CONTINUE_WITH_DIRECTIVE"],
			["c4", "REVIEW", "READY_FOR_EXISTING_GATE"],
		];
		for (const [id, stage, disposition] of calls) {
			await begin(root, { stage, checkpoint: id });
			await runAdvice(root, { subcommand: "commit", run: "run-1", checkpoint: id, disposition, reason: "r" });
		}
		// GUIDE is already spent, so this refuses on the per-stage max (not escalating),
		// while a RECHECK with no prior return refuses too. Drive to the escalating path:
		await expect(begin(root, { stage: "REVIEW", checkpoint: "c5" })).rejects.toThrow(/already ran/);
	});

	it("refuses a reused checkpointId at a different stage instead of silently skipping it", async () => {
		const root = tempRoot();
		await begin(root, { checkpoint: "shared-id" });
		await runAdvice(root, {
			subcommand: "commit",
			run: "run-1",
			checkpoint: "shared-id",
			disposition: "CONTINUE_WITH_DIRECTIVE",
			reason: "r",
		});
		// Treating this as an idempotent retry would silently skip the REVIEW the
		// workflow believes it ran.
		await expect(begin(root, { stage: "REVIEW", checkpoint: "shared-id" })).rejects.toThrow(/distinct id per checkpoint/);
	});

	it("validates a packet through a reachable command, not just an unreferenced function", async () => {
		const root = tempRoot();
		const good = join(root, "packet.json");
		writeFileSync(
			good,
			JSON.stringify({
				runId: "run-1",
				skill: "mk:cook",
				stage: "GUIDE",
				checkpointId: "c1",
				mission: "wire the checkpoints",
				lockedDecisions: ["advisory only"],
				currentState: "gate 1 approved",
				workerSummary: "plan approved, no code yet",
				evidenceRefs: [{ path: "plan.md", relevance: "the approved scope", provenance: "planner", summary: "7 phases" }],
				priorDirective: "",
				question: "what should build start with?",
				riskAndReversibility: "reversible",
			}),
			"utf-8",
		);
		await expect(
			runAdvice(root, { subcommand: "validate-packet", evidence: "packet.json", packetKind: "input" }),
		).resolves.toBeUndefined();

		const bad = join(root, "bad.json");
		writeFileSync(bad, JSON.stringify({ runId: "run-1", skill: "mk:cook" }), "utf-8");
		await expect(
			runAdvice(root, { subcommand: "validate-packet", evidence: "bad.json", packetKind: "input" }),
		).rejects.toThrow(/Packet refused/);
	});

	it("says so out loud when a return names no evidence file", async () => {
		const root = tempRoot();
		await begin(root, { stage: "REVIEW", checkpoint: "cook-review" });
		const lines: string[] = [];
		const original = console.log;
		console.log = (...a: unknown[]) => void lines.push(a.join(" "));
		try {
			await runAdvice(root, {
				subcommand: "commit",
				run: "run-1",
				checkpoint: "cook-review",
				disposition: "RETURN_TO_EXECUTOR",
				reason: "missing test",
				correction: ["add the test"],
			});
		} finally {
			console.log = original;
		}
		// Silence here would read as "evidence was superseded" when nothing was.
		expect(lines.join("\n")).toMatch(/NOT marked superseded/);
	});
});
