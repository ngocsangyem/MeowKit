// Phase 4 Slice A — the extended cohort (`mk:autobuild`, `mk:ship`), ship's
// per-release-stage budget, orchestrator run-id forwarding, and the exclusion set.
//
// The budget tests are the load-bearing half. `mk:ship`'s cap was documented as "4 per
// release stage" while the counter was flat per run, so a run that walked
// prepare → release → publish arrived at publish with its supervision already spent.
// Partitioning fixes that — and every test here exists because the partition is a place
// where a call can be charged to the wrong budget, or to none.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AdviceRefusal, runAdvice } from "../../commands/advice.js";
import {
	PARTITIONED_SKILL_CAPS,
	RELEASE_STAGES,
	SKILL_HARD_CAPS,
	evaluateStageRequest,
	isSupervisedSkill,
	partitionValuesFor,
	type CheckpointRecord,
	type Disposition,
	type SupervisionStage,
} from "../athena-supervision-protocol.js";
import { readDossier } from "../athena-supervision-dossier.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const read = (rel: string): string => readFileSync(join(REPO_ROOT, rel), "utf-8");
const flat = (rel: string): string => read(rel).replace(/\s+/g, " ");

const tempRoot = (): string => mkdtempSync(join(tmpdir(), "athena-extended-"));

const committed = (r: {
	checkpointId: string;
	stage: SupervisionStage;
	disposition: Disposition;
	partition?: string;
}): CheckpointRecord => r;

/** Drive one full checkpoint through the CLI, the way a skill body would. */
async function checkpoint(
	root: string,
	opts: {
		run: string;
		skill: string;
		stage: SupervisionStage;
		checkpoint: string;
		releaseStage?: string;
		disposition: Disposition;
	},
): Promise<void> {
	await runAdvice(root, { subcommand: "begin", ...opts, checkpoint: opts.checkpoint });
	await runAdvice(root, {
		subcommand: "commit",
		run: opts.run,
		checkpoint: opts.checkpoint,
		disposition: opts.disposition,
		outcome: "adopted",
		reason: "test",
		slug: "ship-run",
	});
}

describe("ship budgets supervision per release stage", () => {
	it("declares exactly the three ship scopes as its partition", () => {
		expect(partitionValuesFor("mk:ship")).toEqual(RELEASE_STAGES);
		expect(RELEASE_STAGES).toEqual(["prepare", "release", "publish"]);
	});

	it("refuses a ship call that names no release stage", () => {
		// Not defaulted: assuming `prepare` would charge a publish-time question to a
		// budget that was already spent, and the caller would never see it happen.
		const d = evaluateStageRequest({ skill: "mk:ship", stage: "GUIDE", checkpointId: "g1", history: [] });
		expect(d.allowed).toBe(false);
		if (!d.allowed) {
			expect(d.reason).toMatch(/per release stage/);
			expect(d.escalate).toBe(false);
		}
	});

	it("refuses a release stage that is not one of the three", () => {
		const d = evaluateStageRequest({
			skill: "mk:ship",
			stage: "GUIDE",
			checkpointId: "g1",
			history: [],
			partition: "deploy",
		});
		expect(d.allowed).toBe(false);
		if (!d.allowed) expect(d.reason).toMatch(/not a release stage/);
	});

	it("refuses a release stage on a skill whose cap is per run", () => {
		// The mirror of the case above. Silently ignoring it would let a caller believe
		// it bought a per-stage budget on a skill that has none.
		for (const skill of ["mk:cook", "mk:fix", "mk:autobuild", "mk:plan-creator", "mk:brainstorming"]) {
			const d = evaluateStageRequest({ skill, stage: "GUIDE", checkpointId: "g1", history: [], partition: "release" });
			expect(d.allowed, skill).toBe(false);
			if (!d.allowed) expect(d.reason).toMatch(/takes no release stage/);
		}
	});

	it("spends one stage's budget without touching another's", () => {
		const cap = SKILL_HARD_CAPS["mk:ship"];
		const history = Array.from({ length: cap }, (_, i) =>
			committed({ checkpointId: `p${i}`, stage: "RESCUE", disposition: "ESCALATE_TO_HUMAN", partition: "prepare" }),
		);

		const exhausted = evaluateStageRequest({
			skill: "mk:ship",
			stage: "GUIDE",
			checkpointId: "p-new",
			history,
			partition: "prepare",
		});
		expect(exhausted.allowed).toBe(false);
		if (!exhausted.allowed) {
			expect(exhausted.reason).toMatch(/in prepare/);
			expect(exhausted.escalate).toBe(true);
		}

		// The regression this whole partition exists to prevent: a full `prepare` must
		// not leave `release` with nothing to spend.
		expect(
			evaluateStageRequest({ skill: "mk:ship", stage: "GUIDE", checkpointId: "r1", history, partition: "release" }).allowed,
		).toBe(true);
		expect(
			evaluateStageRequest({ skill: "mk:ship", stage: "GUIDE", checkpointId: "u1", history, partition: "publish" }).allowed,
		).toBe(true);
	});

	it("applies the per-stage maximum within a release stage, not across the run", () => {
		const history = [committed({ checkpointId: "g-prep", stage: "GUIDE", disposition: "CONTINUE_WITH_DIRECTIVE", partition: "prepare" })];
		expect(
			evaluateStageRequest({ skill: "mk:ship", stage: "GUIDE", checkpointId: "g-prep-2", history, partition: "prepare" }).allowed,
		).toBe(false);
		expect(
			evaluateStageRequest({ skill: "mk:ship", stage: "GUIDE", checkpointId: "g-rel", history, partition: "release" }).allowed,
		).toBe(true);
	});

	it("counts unresolved returns per release stage", () => {
		// One resolved return while preparing and an unrelated one while releasing are
		// two episodes. The stricter per-run reading would stop a ship that is behaving.
		const history = [
			committed({ checkpointId: "rev-p", stage: "REVIEW", disposition: "RETURN_TO_EXECUTOR", partition: "prepare" }),
			committed({ checkpointId: "rc-p", stage: "RECHECK", disposition: "RETURN_TO_EXECUTOR", partition: "prepare" }),
		];
		const samePartition = evaluateStageRequest({
			skill: "mk:ship",
			stage: "REVIEW",
			checkpointId: "rev-p2",
			history,
			partition: "prepare",
		});
		expect(samePartition.allowed).toBe(false);
		if (!samePartition.allowed) expect(samePartition.escalate).toBe(true);

		expect(
			evaluateStageRequest({ skill: "mk:ship", stage: "REVIEW", checkpointId: "rev-r", history, partition: "release" }).allowed,
		).toBe(true);
	});

	it("requires a return in the SAME release stage before RECHECK", () => {
		const history = [committed({ checkpointId: "rev-p", stage: "REVIEW", disposition: "RETURN_TO_EXECUTOR", partition: "prepare" })];
		expect(
			evaluateStageRequest({ skill: "mk:ship", stage: "RECHECK", checkpointId: "rc-p", history, partition: "prepare" }).allowed,
		).toBe(true);
		// A return during `prepare` is not returned work in `release` — rechecking there
		// would re-examine evidence nothing returned.
		expect(
			evaluateStageRequest({ skill: "mk:ship", stage: "RECHECK", checkpointId: "rc-r", history, partition: "release" }).allowed,
		).toBe(false);
	});

	it("charges history that names no release stage against EVERY stage", () => {
		// The migration case, and the one a partitioned cap gets wrong by default. A
		// dossier written before ship was partitioned holds entries with no partition
		// field. Skipping them would hand a run that already exhausted its flat cap a
		// fresh 4 calls in each of three stages — an over-permit introduced by a change
		// whose whole justification is that the old counter merely under-permitted.
		const cap = SKILL_HARD_CAPS["mk:ship"];
		const legacy = Array.from({ length: cap }, (_, i) =>
			committed({ checkpointId: `old${i}`, stage: "RESCUE", disposition: "ESCALATE_TO_HUMAN" }),
		);
		for (const stage of RELEASE_STAGES) {
			const d = evaluateStageRequest({
				skill: "mk:ship",
				stage: "GUIDE",
				checkpointId: `new-${stage}`,
				history: legacy,
				partition: stage,
			});
			expect(d.allowed, stage).toBe(false);
			if (!d.allowed) expect(d.escalate).toBe(true);
		}
	});

	it("charges history with an undeclared release stage against every stage", () => {
		// The hand-edit variant of the same hole: a value that matches no declared stage
		// would otherwise be orphaned into a slot that counts nowhere.
		const cap = SKILL_HARD_CAPS["mk:ship"];
		const orphaned = Array.from({ length: cap }, (_, i) =>
			committed({ checkpointId: `x${i}`, stage: "RESCUE", disposition: "ESCALATE_TO_HUMAN", partition: "Prepare" }),
		);
		expect(
			evaluateStageRequest({ skill: "mk:ship", stage: "GUIDE", checkpointId: "n", history: orphaned, partition: "prepare" })
				.allowed,
		).toBe(false);
	});

	it("keeps an unattributable unresolved return counting in every stage", () => {
		// Escalation must not be recoverable by moving to another release stage.
		const legacyReturns = [
			committed({ checkpointId: "r1", stage: "REVIEW", disposition: "RETURN_TO_EXECUTOR" }),
			committed({ checkpointId: "r2", stage: "RECHECK", disposition: "RETURN_TO_EXECUTOR" }),
		];
		for (const stage of RELEASE_STAGES) {
			const d = evaluateStageRequest({
				skill: "mk:ship",
				stage: "REVIEW",
				checkpointId: `rev-${stage}`,
				history: legacyReturns,
				partition: stage,
			});
			expect(d.allowed, stage).toBe(false);
			if (!d.allowed) expect(d.escalate).toBe(true);
		}
	});

	it("keeps idempotency run-wide, so a retry never spends a slot in any stage", () => {
		const history = [committed({ checkpointId: "g1", stage: "GUIDE", disposition: "CONTINUE_WITH_DIRECTIVE", partition: "prepare" })];
		const d = evaluateStageRequest({ skill: "mk:ship", stage: "GUIDE", checkpointId: "g1", history, partition: "prepare" });
		expect(d.allowed).toBe(true);
		if (d.allowed) expect(d.duplicateOf).toBe("g1");
	});
});

describe("the CLI charges calls to the right budget", () => {
	it("refuses `begin` for ship with no --release-stage", async () => {
		const root = tempRoot();
		await expect(
			runAdvice(root, { subcommand: "begin", run: "260726-1200-ship", skill: "mk:ship", stage: "GUIDE", checkpoint: "g1" }),
		).rejects.toThrow(/per release stage/);
	});

	it("persists the partition so accounting survives the process boundary", async () => {
		// Each checkpoint is a separate CLI invocation, so a partition that lived only in
		// memory would vanish and every call would land in the same unpartitioned bucket.
		const root = tempRoot();
		const run = "260726-1200-ship";
		await checkpoint(root, {
			run,
			skill: "mk:ship",
			stage: "GUIDE",
			checkpoint: "g-prep",
			releaseStage: "prepare",
			disposition: "CONTINUE_WITH_DIRECTIVE",
		});
		const stored = readDossier(root, run);
		expect(stored.found).toBe(true);
		if (stored.found) expect(stored.dossier.history[0]?.partition).toBe("prepare");
	});

	it("records the release stage on the receipt", async () => {
		const root = tempRoot();
		const run = "260726-1200-ship";
		await checkpoint(root, {
			run,
			skill: "mk:ship",
			stage: "GUIDE",
			checkpoint: "g-rel",
			releaseStage: "release",
			disposition: "CONTINUE_WITH_DIRECTIVE",
		});
		const dossier = readDossier(root, run);
		expect(dossier.found).toBe(true);
		if (!dossier.found) return;
		const receipt = readFileSync(join(root, dossier.dossier.receiptPointers[0]!), "utf-8");
		// Without it, three ship receipts cannot be told apart from one over-supervised stage.
		expect(receipt).toMatch(/releaseStage: "release"/);
	});

	it("refuses a commit that names a different release stage than the one opened", async () => {
		const root = tempRoot();
		const run = "260726-1200-ship";
		await runAdvice(root, {
			subcommand: "begin",
			run,
			skill: "mk:ship",
			stage: "GUIDE",
			checkpoint: "g1",
			releaseStage: "prepare",
		});
		await expect(
			runAdvice(root, {
				subcommand: "commit",
				run,
				checkpoint: "g1",
				releaseStage: "publish",
				disposition: "CONTINUE_WITH_DIRECTIVE",
				outcome: "adopted",
				reason: "test",
				slug: "ship-run",
			}),
		).rejects.toThrow(/fixed at/);
	});

	it("refuses a checkpoint id reused under a different release stage", async () => {
		// A reused id is a retry only if everything about the call matches. Across stages
		// it is a collision, and accepting it would return the other stage's recorded
		// result while silently skipping this checkpoint — for free.
		const root = tempRoot();
		const run = "260726-1200-ship";
		await checkpoint(root, {
			run,
			skill: "mk:ship",
			stage: "GUIDE",
			checkpoint: "guide",
			releaseStage: "prepare",
			disposition: "CONTINUE_WITH_DIRECTIVE",
		});
		await expect(
			runAdvice(root, {
				subcommand: "begin",
				run,
				skill: "mk:ship",
				stage: "GUIDE",
				checkpoint: "guide",
				releaseStage: "release",
			}),
		).rejects.toThrow(/distinct id per release stage/);
	});

	it("refuses a legacy dossier's exhausted budget in every release stage", async () => {
		// End-to-end reproduction of the migration hole: an on-disk dossier written by the
		// pre-partition code, whose history entries carry no partition at all. Before the
		// fix this printed "1 of 4 for mk:ship / prepare" and did the same for the other
		// two stages — 12 fresh calls handed to a run that had already spent its cap.
		const root = tempRoot();
		const run = "260726-1200-legacy";
		const history = Array.from({ length: SKILL_HARD_CAPS["mk:ship"] }, (_, i) => ({
			checkpointId: `old${i}`,
			stage: "RESCUE",
			disposition: "ESCALATE_TO_HUMAN",
		}));
		mkdirSync(join(root, "tasks", "reports"), { recursive: true });
		writeFileSync(
			join(root, "tasks", "reports", `${run}-athena-supervision.md`),
			`---
kind: athena-supervision-dossier
runId: "${run}"
skill: "mk:ship"
stage: "RESCUE"
lockedDecisionPointers: []
correctionCount: 0
receiptPointers: []
checkpoint: null
history: ${JSON.stringify(history)}
escalatedToHuman: false
---

# Supervision run ${run}

This is supervision continuity, NEVER verification and never a gate approval.

**Latest directive:** (none yet)
**Next safe action:** (none recorded)
`,
			"utf-8",
		);

		const attempt = (stage: string): Promise<void> =>
			runAdvice(root, {
				subcommand: "begin",
				run,
				skill: "mk:ship",
				stage: "GUIDE",
				checkpoint: `new-${stage}`,
				releaseStage: stage,
			});

		// The first attempt hits the cap, and a cap refusal escalates.
		await expect(attempt("prepare")).rejects.toThrow(/supervision cap/);
		// The remaining stages are then blocked by that run-wide escalation rather than by
		// their own cap — a stricter refusal, and the correct one: once a human has been
		// asked, switching release stage is not the way forward.
		for (const stage of ["release", "publish"]) {
			await expect(attempt(stage), stage).rejects.toThrow(/escalated to a human/);
		}
	});

	it("lets one run spend a full budget in every release stage", async () => {
		const root = tempRoot();
		const run = "260726-1200-ship";
		for (const stage of RELEASE_STAGES) {
			await checkpoint(root, {
				run,
				skill: "mk:ship",
				stage: "GUIDE",
				checkpoint: `guide-${stage}`,
				releaseStage: stage,
				disposition: "CONTINUE_WITH_DIRECTIVE",
			});
		}
		const stored = readDossier(root, run);
		expect(stored.found).toBe(true);
		if (stored.found) {
			expect(stored.dossier.history).toHaveLength(3);
			expect(stored.dossier.history.map((h) => h.partition)).toEqual([...RELEASE_STAGES]);
			// Three GUIDEs in one run would be illegal under a flat per-run budget. That
			// they are legal here IS the per-release-stage contract.
			expect(stored.dossier.escalatedToHuman).toBe(false);
		}
	});
});

describe("skills that must never become supervision entry points", () => {
	// Specialists that own a verdict, an interview, or no delivery lifecycle at all.
	// Enforced in code rather than by convention — prose alone does not stop a call.
	//
	// `mk:security` and `mk:project-manager` are the ids the plan and the older contract
	// test use; the live surfaces are the `security` and `project-manager` AGENTS, not
	// skills. Both spellings must be refused, and an id that resolves to nothing is
	// exactly as unwelcome as one that resolves to a specialist — the cap table is an
	// allowlist, so anything absent from it is refused whether or not it exists.
	const EXCLUDED = [
		"mk:review",
		"mk:evaluate",
		"mk:security",
		"mk:project-manager",
		"mk:advise",
		"mk:party",
		"mk:loop",
		"mk:investigate",
		"mk:workflow-orchestrator",
	];

	it.each(EXCLUDED)("%s is not a supervised skill", (skill) => {
		expect(isSupervisedSkill(skill)).toBe(false);
		expect(SKILL_HARD_CAPS[skill]).toBeUndefined();
		expect(partitionValuesFor(skill)).toBeNull();
	});

	it.each(EXCLUDED)("%s is refused at the protocol", (skill) => {
		const d = evaluateStageRequest({ skill, stage: "GUIDE", checkpointId: "g1", history: [] });
		expect(d.allowed).toBe(false);
		if (!d.allowed) expect(d.reason).toMatch(/does not expose --advice/);
	});

	it.each(EXCLUDED)("%s is refused at the CLI and writes nothing", async (skill) => {
		const root = tempRoot();
		const run = "260726-1200-excluded";
		await expect(
			runAdvice(root, { subcommand: "begin", run, skill, stage: "GUIDE", checkpoint: "g1" }),
		).rejects.toBeInstanceOf(AdviceRefusal);
		// A refused entry point must leave no dossier behind: a run record would imply a
		// budget, and a resumed session would read it as a supervised run.
		expect(readDossier(root, run).found).toBe(false);
	});

	it("keeps the supervised set to exactly the six wired skills", () => {
		// A new entry here is a new supervision entry point. It should be a deliberate
		// change with a wrapper behind it, not something that arrives with a cap value.
		expect(Object.keys(SKILL_HARD_CAPS).sort()).toEqual([
			"mk:autobuild",
			"mk:brainstorming",
			"mk:cook",
			"mk:fix",
			"mk:plan-creator",
			"mk:ship",
		]);
		expect(Object.keys(PARTITIONED_SKILL_CAPS)).toEqual(["mk:ship"]);
	});
});

describe("the extended cohort is wired", () => {
	const WIRED = [
		{ skill: "mk:autobuild", cap: 5, main: ".claude/skills/autobuild/SKILL.md", checkpoints: ".claude/skills/autobuild/references/advice-checkpoints.md" },
		{ skill: "mk:ship", cap: 4, main: ".claude/skills/ship/SKILL.md", checkpoints: ".claude/skills/ship/references/advice-checkpoints.md" },
	] as const;

	it.each(WIRED)("$skill declares the flag and its checkpoint reference exists", ({ main, checkpoints }) => {
		expect(flat(main)).toContain("--advice");
		expect(existsSync(join(REPO_ROOT, checkpoints)), checkpoints).toBe(true);
	});

	it.each(WIRED)("$skill's documented cap matches the code's cap", ({ skill, cap, checkpoints }) => {
		expect(isSupervisedSkill(skill)).toBe(true);
		expect(SKILL_HARD_CAPS[skill]).toBe(cap);
		expect(flat(checkpoints)).toContain(`Hard cap **${cap}`);
	});

	it.each(WIRED)("$skill names all four stages and both CLI calls", ({ checkpoints }) => {
		const body = read(checkpoints);
		for (const stage of ["GUIDE", "RESCUE", "REVIEW", "RECHECK"]) expect(body, stage).toContain(stage);
		expect(body).toContain("mewkit advice begin");
		expect(body).toContain("mewkit advice commit");
	});

	it.each(WIRED)("$skill states the flag-off behavior and forbids inline self-advice", ({ checkpoints }) => {
		expect(flat(checkpoints)).toMatch(/[Ww]ithout the flag there are zero supervision calls/);
		expect(flat(checkpoints)).toMatch(/Never write a packet inline and present it as Athena's/);
	});
});

describe("boundaries the extended wiring must not erode", () => {
	it("autobuild fires macro checkpoints, never per iteration or per artifact", () => {
		const body = flat(".claude/skills/autobuild/references/advice-checkpoints.md");
		expect(body).toMatch(/never per generated artifact, per file, or per evaluator iteration/);
		expect(body).toMatch(/five-round build makes the same number of calls/);
	});

	it("autobuild's rescue does not buy an iteration or delay the escalation", () => {
		const ref = flat(".claude/skills/autobuild/references/advice-checkpoints.md");
		expect(ref).toMatch(/never buys another round and never delays the escalation/);
		expect(ref).toMatch(/consumes an `--max-iter` round/);
		const step = flat(".claude/skills/autobuild/step-05-iterate-or-ship.md");
		expect(step).toMatch(/neither delays it nor substitutes for it/);
	});

	it("autobuild's REVIEW precedes Gate 2 and clears nothing", () => {
		const step = flat(".claude/skills/autobuild/step-05-iterate-or-ship.md");
		expect(step).toMatch(/fire the REVIEW checkpoint here, \*\*before\*\* the question below/);
		expect(step).toMatch(/not a second approval, and it is not the approval/);
		// The Gate 2 prompt itself must still be the thing that follows.
		expect(step).toMatch(/Do NOT dispatch the shipper until the human approves/);
	});

	it("autobuild fires GUIDE at the contract boundary, not per step", () => {
		expect(flat(".claude/skills/autobuild/step-02-contract.md")).toMatch(/single GUIDE checkpoint/);
	});

	it("ship states that counsel is not authorization", () => {
		const body = flat(".claude/skills/ship/references/advice-checkpoints.md");
		expect(body).toMatch(/Counsel is not authorization/);
		expect(body).toMatch(/never\*\* creates the authority to push, open a PR, merge, version, publish, or deploy/);
		expect(flat(".claude/skills/ship/SKILL.md")).toMatch(/Counsel is not authorization/);
	});

	it("ship reviews only a terminal green pipeline", () => {
		const body = flat(".claude/skills/ship/references/advice-checkpoints.md");
		expect(body).toMatch(/only after CI reaches a terminal state/);
		expect(body).toMatch(/cannot clear a red CI, wave through a pending one, or shorten the wait/);
	});

	it("ship keeps external comments behind explicit authority", () => {
		expect(flat(".claude/skills/ship/references/advice-checkpoints.md")).toMatch(
			/default is a local receipt under `tasks\/reports\/`/,
		);
	});

	it("the orchestrator forwards a run id and never enables supervision", () => {
		const body = flat(".claude/skills/workflow-orchestrator/SKILL.md");
		expect(body).toMatch(/No `--advice` flag/);
		expect(body).toMatch(/never\s+enables `--advice`/);
		expect(body).toMatch(/opaque value/);
		expect(body).toMatch(/never supervise itself/);
		// It must not become an entry point by accident either.
		expect(isSupervisedSkill("mk:workflow-orchestrator")).toBe(false);
	});
});

describe("the canonical rule agrees with the extended wiring", () => {
	const rule = flat(".claude/rules-conditional/advice-supervision-rules.md");

	it("lists all six wired skills inside the wired sentence", () => {
		const wiredSentence = /((?:`mk:[a-z-]+`(?: \(deep only\))?,? ?)+) — wired\./.exec(rule)?.[1] ?? "";
		for (const s of ["mk:fix", "mk:cook", "mk:brainstorming", "mk:plan-creator", "mk:autobuild", "mk:ship"]) {
			expect(wiredSentence, s).toContain(s);
		}
		expect(rule).not.toMatch(/not yet wired/);
	});

	it("states ship's cap as per release stage, with no unenforced caveat", () => {
		expect(rule).toMatch(/4 \*\*per release stage\*\*/);
		// The old text conceded its own mismatch. If that phrasing returns, so has the bug.
		expect(rule).not.toMatch(/not yet enforced as stated/);
		expect(rule).toContain("--release-stage");
	});

	it("records that the orchestrator is not an entry point", () => {
		expect(rule).toMatch(/`mk:workflow-orchestrator` exposes \*\*no flag\*\*/);
	});
});
