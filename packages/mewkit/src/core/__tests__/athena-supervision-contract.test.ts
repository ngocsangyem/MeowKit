import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	DISPOSITIONS,
	GATE_ADVANCING_DISPOSITIONS,
	PER_STAGE_MAX,
	SKILL_HARD_CAPS,
	SUPERVISION_STAGES,
	evaluateStageRequest,
	isDispositionLegal,
	isSupervisedSkill,
	legalDispositions,
	reconcileStatus,
	type CheckpointRecord,
	type SupervisionStage,
} from "../athena-supervision-protocol.js";
import {
	INPUT_PACKET_MAX_BYTES,
	MAX_EVIDENCE_POINTERS,
	MAX_REQUIRED_CORRECTIONS,
	OUTPUT_PACKET_MAX_WORDS,
	scanForbiddenContent,
	validateInputPacket,
	validateOutputPacket,
} from "../athena-supervision-packet.js";
import {
	ACTIVE_SUMMARY_MAX_BYTES,
	FORBIDDEN_DOSSIER_FIELDS,
	beginCheckpoint,
	commitCheckpoint,
	dossierPath,
	renderDossier,
	validateDossier,
	writeDossier,
	type Dossier,
} from "../athena-supervision-dossier.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function tempRoot(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "athena-supervision-"));
	tempDirs.push(dir);
	return dir;
}

const validInput = (over: Record<string, unknown> = {}) => ({
	runId: "run-1",
	skill: "mk:cook",
	stage: "GUIDE" as const,
	checkpointId: "cook-guide-1",
	mission: "Add opt-in supervision to the cook pipeline",
	lockedDecisions: ["explicit flag only"],
	currentState: "Gate 1 approved; build not started",
	workerSummary: "plan approved, no source edits yet",
	evidenceRefs: [{ path: "tasks/plans/x/plan.md", relevance: "approved scope", provenance: "planner", summary: "7 phases" }],
	priorDirective: null,
	question: "Which risk should the build address first?",
	riskAndReversibility: "reversible; no public contract touched",
	...over,
});

const validOutput = (over: Record<string, unknown> = {}) => ({
	disposition: "CONTINUE_WITH_DIRECTIVE" as const,
	strategicAssessment: "The boundary validator is the highest-leverage constraint.",
	decisionRecommendation: "Constrain the packet boundary before adding checkpoint wiring.",
	strategicDirective: "Start with the packet validator; it constrains everything downstream.",
	requiredCorrections: [],
	nextFalsifiableCheck: "run the focused contract test",
	risksAndRollback: "revert the flag route",
	rejectedAlternatives: "a new supervise skill — more surface, no added safety",
	assumptions: "Node 24 available",
	confidence: "medium" as const,
	evidenceRead: ["tasks/plans/x/plan.md"],
	...over,
});

const baseDossier = (over: Partial<Dossier> = {}): Dossier => ({
	runId: "run-1",
	skill: "mk:cook",
	stage: "GUIDE",
	lockedDecisionPointers: ["plan.md#locked-decisions"],
	latestDirective: "start with the validator",
	correctionCount: 0,
	receiptPointers: [],
	nextSafeAction: "implement packet schema",
	checkpoint: null,
	...over,
});

describe("stage and disposition legality", () => {
	it("permits only forward-looking dispositions at GUIDE and RESCUE", () => {
		for (const stage of ["GUIDE", "RESCUE"] as SupervisionStage[]) {
			expect(isDispositionLegal(stage, "CONTINUE_WITH_DIRECTIVE")).toBe(true);
			expect(isDispositionLegal(stage, "READY_FOR_EXISTING_GATE")).toBe(false);
			expect(isDispositionLegal(stage, "RETURN_TO_EXECUTOR")).toBe(false);
		}
	});

	it("permits only backward-looking dispositions at REVIEW and RECHECK", () => {
		for (const stage of ["REVIEW", "RECHECK"] as SupervisionStage[]) {
			expect(isDispositionLegal(stage, "READY_FOR_EXISTING_GATE")).toBe(true);
			expect(isDispositionLegal(stage, "RETURN_TO_EXECUTOR")).toBe(true);
			expect(isDispositionLegal(stage, "CONTINUE_WITH_DIRECTIVE")).toBe(false);
		}
	});

	it("allows escalation and missing-evidence from every stage", () => {
		for (const stage of SUPERVISION_STAGES) {
			expect(isDispositionLegal(stage, "ESCALATE_TO_HUMAN")).toBe(true);
			expect(isDispositionLegal(stage, "BLOCKED_MISSING_EVIDENCE")).toBe(true);
		}
	});

	it("covers every declared disposition in at least one stage", () => {
		const covered = new Set(SUPERVISION_STAGES.flatMap((s) => [...legalDispositions(s)]));
		expect([...covered].sort()).toEqual([...DISPOSITIONS].sort());
	});

	// The load-bearing invariant: no disposition may advance a gate.
	it("declares no gate-advancing disposition", () => {
		expect(GATE_ADVANCING_DISPOSITIONS).toEqual([]);
	});
});

describe("cadence, caps and idempotency", () => {
	const committed = (over: Partial<CheckpointRecord> = {}): CheckpointRecord => ({
		checkpointId: "c1",
		stage: "GUIDE",
		disposition: "CONTINUE_WITH_DIRECTIVE",
		...over,
	});

	it("treats a repeated checkpointId as idempotent without spending a slot", () => {
		const history = [committed({ checkpointId: "cook-guide-1" })];
		const d = evaluateStageRequest({ skill: "mk:cook", stage: "GUIDE", checkpointId: "cook-guide-1", history });
		expect(d).toEqual({ allowed: true, duplicateOf: "cook-guide-1" });
	});

	it("refuses a second GUIDE in one run", () => {
		const history = [committed({ checkpointId: "g1" })];
		const d = evaluateStageRequest({ skill: "mk:cook", stage: "GUIDE", checkpointId: "g2", history });
		expect(d.allowed).toBe(false);
	});

	it("allows RESCUE without a prior GUIDE (a run can stall before the guide checkpoint)", () => {
		const d = evaluateStageRequest({ skill: "mk:fix", stage: "RESCUE", checkpointId: "r1", history: [] });
		expect(d.allowed).toBe(true);
	});

	it("refuses RECHECK when nothing was returned", () => {
		const history = [committed({ checkpointId: "rev1", stage: "REVIEW", disposition: "READY_FOR_EXISTING_GATE" })];
		const d = evaluateStageRequest({ skill: "mk:cook", stage: "RECHECK", checkpointId: "rc1", history });
		expect(d.allowed).toBe(false);
		if (!d.allowed) expect(d.reason).toMatch(/requires a prior RETURN_TO_EXECUTOR/);
	});

	it("escalates rather than looping after two unresolved returns", () => {
		const history = [
			committed({ checkpointId: "rev1", stage: "REVIEW", disposition: "RETURN_TO_EXECUTOR" }),
			committed({ checkpointId: "rc1", stage: "RECHECK", disposition: "RETURN_TO_EXECUTOR" }),
		];
		const d = evaluateStageRequest({ skill: "mk:cook", stage: "RECHECK", checkpointId: "rc2", history });
		expect(d.allowed).toBe(false);
		if (!d.allowed) expect(d.escalate).toBe(true);
	});

	it("enforces the per-skill hard cap", () => {
		const cap = SKILL_HARD_CAPS["mk:ship"];
		const history = Array.from({ length: cap }, (_, i) =>
			committed({ checkpointId: `c${i}`, stage: "RESCUE", disposition: "ESCALATE_TO_HUMAN" }),
		);
		const d = evaluateStageRequest({ skill: "mk:ship", stage: "REVIEW", checkpointId: "new", history });
		expect(d.allowed).toBe(false);
		if (!d.allowed) expect(d.escalate).toBe(true);
	});

	it("refuses skills that do not expose --advice", () => {
		for (const skill of ["mk:review", "mk:evaluate", "mk:security", "mk:project-manager", "mk:loop", "mk:advise"]) {
			expect(isSupervisedSkill(skill)).toBe(false);
			expect(evaluateStageRequest({ skill, stage: "GUIDE", checkpointId: "x", history: [] }).allowed).toBe(false);
		}
	});

	it("keeps per-stage maxima at the documented cadence", () => {
		expect(PER_STAGE_MAX).toEqual({ GUIDE: 1, RESCUE: 2, REVIEW: 1, RECHECK: 1 });
	});
});

describe("transport status vs disposition precedence", () => {
	it("routes on the disposition when a packet is delivered", () => {
		expect(reconcileStatus("DONE", "RETURN_TO_EXECUTOR")).toEqual({ valid: true, route: "RETURN_TO_EXECUTOR" });
		expect(reconcileStatus("DONE_WITH_CONCERNS", "READY_FOR_EXISTING_GATE")).toEqual({
			valid: true,
			route: "READY_FOR_EXISTING_GATE",
		});
	});

	it("rejects a delivered packet with no disposition", () => {
		expect(reconcileStatus("DONE", null).valid).toBe(false);
	});

	it("rejects BLOCKED carrying a usable directive", () => {
		const r = reconcileStatus("BLOCKED", "CONTINUE_WITH_DIRECTIVE");
		expect(r.valid).toBe(false);
	});

	it("normalizes BLOCKED to missing-evidence", () => {
		expect(reconcileStatus("BLOCKED", null)).toEqual({ valid: true, route: "BLOCKED_MISSING_EVIDENCE" });
	});
});

describe("input packet validation", () => {
	it("accepts a well-formed packet", () => {
		expect(validateInputPacket(validInput())).toEqual({ ok: true, errors: [] });
	});

	it("rejects an evidence pointer missing provenance", () => {
		const r = validateInputPacket(
			validInput({ evidenceRefs: [{ path: "a.md", relevance: "x", provenance: "", summary: "y" }] }),
		);
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/provenance/);
	});

	it("rejects more than the pointer budget", () => {
		const refs = Array.from({ length: MAX_EVIDENCE_POINTERS + 1 }, (_, i) => ({
			path: `f${i}.md`,
			relevance: "r",
			provenance: "p",
			summary: "s",
		}));
		expect(validateInputPacket(validInput({ evidenceRefs: refs })).ok).toBe(false);
	});

	it("rejects an oversize packet", () => {
		const r = validateInputPacket(validInput({ currentState: "x".repeat(INPUT_PACKET_MAX_BYTES + 1) }));
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/over the \d+B cap/);
	});

	it("rejects a pasted diff, transcript, memory dump and stack log", () => {
		const cases = [
			"diff --git a/x b/x\n+++ b/x\n@@ -1 +1 @@",
			"User: do the thing\nAssistant: ok\nUser: again\nAssistant: sure",
			"##decision: a\n##pattern: b\n##note: c\n##decision: d",
			"    at foo (/a/b.ts:1:2)\n    at bar (/a/c.ts:3:4)\n    at baz (/a/d.ts:5:6)",
		];
		for (const payload of cases) {
			expect(validateInputPacket(validInput({ workerSummary: payload })).ok).toBe(false);
		}
	});

	it("rejects credentials in any prose field", () => {
		const secrets = [
			"-----BEGIN PRIVATE KEY-----",
			"AKIAIOSFODNN7EXAMPLE",
			"Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123",
			"ghp_abcdefghijklmnopqrstuvwxyz0123",
			'api_key = "abcdef1234567890"',
		];
		for (const s of secrets) {
			const r = validateInputPacket(validInput({ currentState: `state ${s}` }));
			expect(r.ok, s).toBe(false);
			expect(r.errors.join(" ")).toMatch(/never carry credentials/);
		}
	});

	// A pointer legitimately NAMES a diff report without containing one.
	it("does not flag an evidence path that merely mentions a diff", () => {
		const r = validateInputPacket(
			validInput({
				evidenceRefs: [
					{
						path: "tasks/reports/fix-diff.md",
						relevance: "the diff under review",
						provenance: "developer",
						summary: "3 files",
					},
				],
			}),
		);
		expect(r.ok).toBe(true);
	});

	it("tolerates a single quoted dialogue line as evidence", () => {
		expect(validateInputPacket(validInput({ workerSummary: 'User: "it still fails"' })).ok).toBe(true);
	});

	// The path field is exempt from BULK-content scanning so a filename like
	// `fix-diff.md` stays legal. That exemption must not become a credential channel.
	it("rejects a credential smuggled through an evidence pointer path", () => {
		const r = validateInputPacket(
			validInput({
				evidenceRefs: [
					{ path: "-----BEGIN RSA PRIVATE KEY-----MIIabc", relevance: "x", provenance: "p", summary: "y" },
				],
			}),
		);
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/never carry credentials/);
	});

	it("rejects a multi-line payload disguised as a pointer path", () => {
		const r = validateInputPacket(
			validInput({
				evidenceRefs: [{ path: "notes.md\ndiff --git a/x b/x", relevance: "x", provenance: "p", summary: "y" }],
			}),
		);
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/single-line path/);
	});

	// An unknown key is an unscanned field AND makes the byte cap a lie, because the
	// caller serializes a larger shape than the one that was measured.
	it("rejects unknown keys instead of silently stripping them", () => {
		const r = validateInputPacket(validInput({ smuggled: "-----BEGIN RSA PRIVATE KEY-----" }));
		expect(r.ok).toBe(false);
	});
});

describe("output packet validation", () => {
	it("accepts a well-formed packet", () => {
		expect(validateOutputPacket(validOutput())).toEqual({ ok: true, errors: [] });
	});

	it("rejects approval, clearance and gate-advancing language", () => {
		const phrases = [
			"This is approved, proceed to ship.",
			"You are cleared to proceed past review.",
			"This advances Gate 2 once tests pass.",
			"Merge is approved.",
			"This counts as verification.",
		];
		for (const strategicDirective of phrases) {
			const r = validateOutputPacket(validOutput({ strategicDirective }));
			expect(r.ok, strategicDirective).toBe(false);
		}
	});

	it("permits evidence-framed wording", () => {
		expect(validateOutputPacket(validOutput({ decisionRecommendation: "The evidence supports landing the validator first." })).ok).toBe(
			true,
		);
	});

	it("rejects RETURN_TO_EXECUTOR with no corrections", () => {
		const r = validateOutputPacket(validOutput({ disposition: "RETURN_TO_EXECUTOR", requiredCorrections: [] }));
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/at least one required correction/);
	});

	it("rejects more than the correction budget", () => {
		const corrections = Array.from({ length: MAX_REQUIRED_CORRECTIONS + 1 }, (_, i) => ({
			change: `c${i}`,
			proofRequired: "test",
		}));
		expect(validateOutputPacket(validOutput({ disposition: "RETURN_TO_EXECUTOR", requiredCorrections: corrections })).ok).toBe(
			false,
		);
	});

	it("requires proof for every correction", () => {
		const r = validateOutputPacket(
			validOutput({ disposition: "RETURN_TO_EXECUTOR", requiredCorrections: [{ change: "fix it", proofRequired: "" }] }),
		);
		expect(r.ok).toBe(false);
	});

	it("rejects output over the word cap", () => {
		const r = validateOutputPacket(validOutput({ strategicDirective: "word ".repeat(OUTPUT_PACKET_MAX_WORDS + 5) }));
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/over the \d+-word cap/);
	});

	it("rejects an illegal disposition value", () => {
		expect(validateOutputPacket(validOutput({ disposition: "APPROVED" })).ok).toBe(false);
	});

	// The supervisor opens the files it is pointed at, so its own prose can quote them
	// back. The return trip must not be laxer than the outbound one.
	it("rejects a credential echoed back in returned prose", () => {
		const r = validateOutputPacket(validOutput({ assumptions: 'the config sets api_key = "abcdef1234567890"' }));
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/never carry credentials/);
	});

	it("rejects a credential in the evidence-read list", () => {
		const r = validateOutputPacket(validOutput({ evidenceRead: ["AKIAIOSFODNN7EXAMPLE"] }));
		expect(r.ok).toBe(false);
	});
});

describe("forbidden-content scanner", () => {
	it("returns nothing for ordinary prose", () => {
		expect(scanForbiddenContent("Two approaches failed; the root cause is an unresolved import.")).toEqual([]);
	});
});

describe("continuity dossier", () => {
	it("accepts a compact dossier", () => {
		expect(validateDossier(baseDossier())).toEqual({ ok: true, errors: [] });
	});

	it("refuses every progress, verification and gate field", () => {
		for (const field of FORBIDDEN_DOSSIER_FIELDS) {
			const r = validateDossier({ ...baseDossier(), [field]: "anything" });
			expect(r.ok, field).toBe(false);
			expect(r.errors.join(" ")).toMatch(/belongs to the task record/);
		}
	});

	it("rejects an oversize active summary", () => {
		const r = validateDossier(baseDossier({ latestDirective: "x".repeat(ACTIVE_SUMMARY_MAX_BYTES) }));
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/over the \d+B cap/);
	});

	it("rejects an unsafe run id and builds a deterministic path", () => {
		expect(() => dossierPath("/tmp/p", "../escape")).toThrow(/invalid supervision run id/);
		expect(dossierPath("/tmp/p", "run-1")).toBe("/tmp/p/tasks/reports/run-1-athena-supervision.md");
	});

	it("states in the artifact that it is not verification", () => {
		expect(renderDossier(baseDossier())).toMatch(/NEVER verification and never a gate approval/);
	});

	it("marks a checkpoint pending before the call and committed after", () => {
		const pending = beginCheckpoint(baseDossier(), { checkpointId: "c1", stage: "REVIEW" });
		expect(pending.checkpoint).toEqual({ checkpointId: "c1", stage: "REVIEW", state: "pending" });

		const done = commitCheckpoint(pending, {
			latestDirective: "return work: missing regression test",
			nextSafeAction: "add the test",
			receiptPointer: "tasks/reports/run-1-advice-1.md",
			corrections: 2,
		});
		expect(done.checkpoint?.state).toBe("committed");
		expect(done.correctionCount).toBe(2);
		expect(done.receiptPointers).toEqual(["tasks/reports/run-1-advice-1.md"]);
	});

	it("writes atomically and preserves never-auto-loaded history across writes", async () => {
		const root = await tempRoot();
		const target = await writeDossier(root, baseDossier());
		await writeFile(
			target,
			(await readFile(target, "utf-8")) + "\n<!-- supervision-history (never auto-loaded) -->\nold receipt\n",
			"utf-8",
		);

		await writeDossier(root, baseDossier({ latestDirective: "second directive" }));
		const body = await readFile(target, "utf-8");
		expect(body).toMatch(/second directive/);
		expect(body).toMatch(/old receipt/);
		// The active summary must not accumulate: only one frontmatter block.
		expect(body.match(/kind: athena-supervision-dossier/g)).toHaveLength(1);
	});

	it("never writes an invalid dossier to disk", async () => {
		const root = await tempRoot();
		await mkdir(join(root, "tasks", "reports"), { recursive: true });
		await expect(writeDossier(root, { ...baseDossier(), correctionCount: -1 } as Dossier)).rejects.toThrow(
			/invalid supervision dossier/,
		);
	});

	// Resume must reconstruct from pointers, not from prior counsel text.
	it("resumes from the compact record without any counsel history", async () => {
		const root = await tempRoot();
		await writeDossier(
			root,
			baseDossier({ latestDirective: "add the regression test", nextSafeAction: "run focused tests", correctionCount: 1 }),
		);
		const body = await readFile(dossierPath(root, "run-1"), "utf-8");
		expect(body).toMatch(/add the regression test/);
		expect(body).toMatch(/run focused tests/);
		expect(Buffer.byteLength(body, "utf8")).toBeLessThanOrEqual(ACTIVE_SUMMARY_MAX_BYTES);
	});
});
