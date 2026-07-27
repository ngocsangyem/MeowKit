// `mk:brainstorming` and `mk:plan-creator` checkpoint wiring.
//
// These assert the live tree, not fixtures: the failure this guards against is a
// skill declaring `--advice` while its checkpoints, caps, or role boundaries drift
// away from the canonical contract.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SKILL_HARD_CAPS, isSupervisedSkill } from "../athena-supervision-protocol.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const read = (rel: string): string => readFileSync(join(REPO_ROOT, rel), "utf-8");
const flat = (rel: string): string => read(rel).replace(/\s+/g, " ");

const WIRED = [
	{
		skill: "mk:brainstorming",
		cap: 4,
		main: ".claude/skills/brainstorming/SKILL.md",
		checkpoints: ".claude/skills/brainstorming/references/advice-checkpoints.md",
	},
	{
		skill: "mk:plan-creator",
		cap: 4,
		main: ".claude/skills/plan-creator/SKILL.md",
		checkpoints: ".claude/skills/plan-creator/references/advice-checkpoints.md",
	},
] as const;

describe("slice B skills are wired", () => {
	it.each(WIRED)("$skill declares the flag and its checkpoint reference exists", ({ main, checkpoints }) => {
		expect(flat(main)).toContain("--advice");
		expect(existsSync(join(REPO_ROOT, checkpoints)), checkpoints).toBe(true);
	});

	it.each(WIRED)("$skill's documented cap matches the code's cap", ({ skill, cap, checkpoints }) => {
		// Prose and code disagreeing about a cap is how a "bounded" surface quietly
		// becomes unbounded — the code is authoritative, so they must agree.
		expect(isSupervisedSkill(skill)).toBe(true);
		expect(SKILL_HARD_CAPS[skill]).toBe(cap);
		expect(flat(checkpoints)).toContain(`Hard cap **${cap} calls per run**`);
	});

	it.each(WIRED)("$skill names all four stages at declared boundaries", ({ checkpoints }) => {
		const body = read(checkpoints);
		for (const stage of ["GUIDE", "RESCUE", "REVIEW", "RECHECK"]) expect(body, stage).toContain(stage);
		expect(body).toContain("mewkit advice begin");
		expect(body).toContain("mewkit advice commit");
	});

	it.each(WIRED)("$skill states the flag-off behavior explicitly", ({ checkpoints }) => {
		expect(flat(checkpoints)).toMatch(/[Ww]ithout the flag there are zero supervision calls/);
	});

	it.each(WIRED)("$skill forbids inline self-advice", ({ checkpoints }) => {
		// A recommendation written by the agent that is stuck is not an independent
		// check, and a receipt recording it as one corrupts the audit trail.
		expect(flat(checkpoints)).toMatch(/Never write a packet inline and present it as Athena's/);
	});
});

describe("role boundaries the wiring must not erode", () => {
	it("brainstorming keeps option generation and refuses to add a gate", () => {
		const body = flat(".claude/skills/brainstorming/references/advice-checkpoints.md");
		expect(body).toMatch(/does not generate a second set of approaches/);
		expect(body).toMatch(/does not choose for the user/);
		expect(body).toMatch(/never adds a gate/);
	});

	it("brainstorming wires deep runs only, and says what quick does instead", () => {
		// Quick answers inline in three steps and creates no artifact; supervising it
		// is noise, not safety.
		const body = flat(".claude/skills/brainstorming/references/advice-checkpoints.md");
		expect(body).toMatch(/applies to the \*\*deep\*\* workflow/);
		expect(body).toMatch(/continuing unsupervised/);
	});

	it("plan-creator states that Athena cannot approve Gate 1", () => {
		const body = flat(".claude/skills/plan-creator/references/advice-checkpoints.md");
		expect(body).toMatch(/Athena does not approve Gate 1/);
		expect(body).toMatch(/REVIEW checkpoint is not a pre-approval/);
		expect(body).toMatch(/does not write the plan/);
	});

	it("plan-creator fires REVIEW before the gate step, and the gate step says so", () => {
		expect(flat(".claude/skills/plan-creator/references/advice-checkpoints.md")).toMatch(/before.{0,40}`step-07-gate`/);
		const gateStep = flat(".claude/skills/plan-creator/step-07-gate.md");
		expect(gateStep).toMatch(/REVIEW checkpoint fires BEFORE this step/);
		expect(gateStep).toMatch(/does not approve Gate 1/);
	});

	it("plan-creator's step files carry the checkpoint pointers", () => {
		expect(flat(".claude/skills/plan-creator/step-00-scope-challenge.md")).toContain("GUIDE checkpoint");
		expect(flat(".claude/skills/plan-creator/step-05-red-team.md")).toContain("RESCUE checkpoint");
	});
});

describe("the canonical rule agrees with the wiring", () => {
	const rule = flat(".claude/rules-conditional/advice-supervision-rules.md");

	it("lists all four wired skills inside the wired bullet, not merely somewhere in the file", () => {
		// Anchored to the "— wired." sentence: every skill name appears elsewhere in
		// this rule (cap table, governs list), so an unanchored match would pass even
		// with the wiring status untouched.
		const wiredSentence = /((?:`mk:[a-z-]+`(?: \(deep only\))?,? ?)+) — wired\./.exec(rule)?.[1] ?? "";
		for (const s of ["mk:fix", "mk:cook", "mk:brainstorming", "mk:plan-creator"]) {
			expect(wiredSentence, s).toContain(s);
		}
	});

	it("documents the brief as a separate shape that cannot carry a disposition", () => {
		expect(rule).toMatch(/strategy brief/);
		expect(rule).toMatch(/refused, not stripped/);
		expect(rule).toContain("--packet-kind brief");
	});

	it("does not claim provider support that has not been smoke-tested", () => {
		// Locked decision 6: an unverified capability reports unverified/unavailable
		// rather than simulating parity.
		const authored = read("packages/mewkit/src/core/capability-authored.ts");
		const block = authored.slice(authored.indexOf('id: "advice-supervision"'));
		expect(block.slice(0, 900)).not.toMatch(/support:\s*\[\s*\{/);
	});
});
