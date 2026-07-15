import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkGateAuthority, scanForGateAuthority } from "../check-gate-authority.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Build a throwaway project root with `.claude/<relPath>` files. */
async function projectWith(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "gate-authority-"));
	tempDirs.push(root);
	for (const [rel, body] of Object.entries(files)) {
		const abs = join(root, rel);
		await mkdir(join(abs, ".."), { recursive: true });
		await writeFile(abs, body, "utf-8");
	}
	return root;
}

describe("scanForGateAuthority — statements that grant automated approval", () => {
	// Both word orders, because a fixed pattern set that only knows one is a
	// pattern set that a rewrite walks straight through.
	it.each([
		["auto-approve then gate", "Compared to Fast: enforces both gates fully (Fast auto-approves Gate 2 if tests pass)."],
		["gate then auto-approved", "**Output:** `Phase 1: Plan created — [N] phases, Gate 1 [approved|auto-approved]`"],
		["gate bound to auto", "| auto | Yes | RED-strict | Gate 1: Auto (validated) | Human |"],
		["stamp as authority", "      - Gate 2 review verdict satisfied (the evaluator stamp counts)"],
		["gate prompt skipped", "**Auto mode:** Skip Gate 1 user prompt. validate-gate-1.sh remains blocking."],
	])("flags %s", async (_label, line) => {
		const root = await projectWith({ ".claude/modes/x.md": line });
		const found = scanForGateAuthority(root, ".claude/modes/x.md");
		expect(found).toHaveLength(1);
		expect(found[0].line).toBe(1);
	});

	it("reports file, line, and the offending text", async () => {
		const root = await projectWith({
			".claude/modes/x.md": ["# Modes", "", "Fast auto-approves Gate 2 if tests pass."].join("\n"),
		});
		const found = scanForGateAuthority(root, ".claude/modes/x.md");
		expect(found).toEqual([
			{
				file: ".claude/modes/x.md",
				line: 3,
				found: "Fast auto-approves Gate 2 if tests pass.",
				expected: "automation executes between gates; a human approves the gate",
			},
		]);
	});
});

describe("scanForGateAuthority — prose that states the contract is not a violation", () => {
	// Every one of these is real prose from the kit. Flagging them would train
	// authors to disable the check.
	it.each([
		["Gate 2 is never auto-approved."],
		["Auto mode auto-FIXES but does NOT auto-APPROVE Gate 2."],
		["Auto mode auto-fixes issues but never auto-approves Gate 2."],
		["Gate 2: human approval mandatory in all modes — see gate-rules.md."],
		["No mode auto-approves a gate."],
		["Gate 1 requires that a human has explicitly typed approval."],
	])("does not flag %s", async (line) => {
		const root = await projectWith({ ".claude/rules/x.md": line });
		expect(scanForGateAuthority(root, ".claude/rules/x.md")).toEqual([]);
	});

	it("does not flag a skill's own HARD GATE vocabulary", async () => {
		const root = await projectWith({
			".claude/skills/chom/SKILL.md": "- `--auto`: auto-approve non-HARD-GATE steps. HARD GATE still requires human approval.",
		});
		expect(scanForGateAuthority(root, ".claude/skills/chom/SKILL.md")).toEqual([]);
	});

	// A bare "gate" is a domain metaphor, not a claim about Gate 1 / Gate 2. An
	// earlier revision made the digit optional and fired on prose like this.
	it("does not flag a gate metaphor that names no gate number", async () => {
		const root = await projectWith({
			".claude/skills/x/SKILL.md": "This skill auto-approves lower-priority checks, but the quality gate stays manual.",
		});
		expect(scanForGateAuthority(root, ".claude/skills/x/SKILL.md")).toEqual([]);
	});

	it("does not flag a documented gate bypass, which is not a grant of authority", async () => {
		const root = await projectWith({
			".claude/rules/gate-rules.md": "`/mk:fix` with complexity=simple bypasses Gate 1. The fix IS the plan.",
		});
		expect(scanForGateAuthority(root, ".claude/rules/gate-rules.md")).toEqual([]);
	});
});

describe("scanForGateAuthority — negation is scoped to the clause it governs", () => {
	// These are the false negatives that matter most: each ASSERTS automated gate
	// approval while carrying an incidental negation in a DIFFERENT clause. A
	// line-wide negation test passes all of them, reporting green over exactly
	// the regression the lint exists to catch.
	it.each([
		[
			"negation in a trailing subordinate clause",
			"Fast mode auto-approves Gate 2 whenever the evaluator score is high enough, so no separate human click is required for passing runs.",
		],
		[
			"negation attached to the evaluator, not to the approval",
			"The harness auto-approves Gate 2 once the evaluator cannot find any blocking issue in the diff.",
		],
		[
			"negation belonging to an unrelated later sentence fragment",
			"Auto mode auto-approves Gate 1 after validation — reviewers are not required to re-check the plan.",
		],
	])("flags a violation despite %s", async (_label, line) => {
		const root = await projectWith({ ".claude/modes/x.md": line });
		expect(scanForGateAuthority(root, ".claude/modes/x.md")).toHaveLength(1);
	});

	// The mirror case: the negation genuinely governs the claim. Still clean.
	it.each([
		["Gate 2 is never auto-approved."],
		["Auto mode auto-FIXES but does NOT auto-APPROVE Gate 2."],
		["Auto mode auto-fixes issues but never auto-approves Gate 2."],
	])("still does not flag %s", async (line) => {
		const root = await projectWith({ ".claude/rules/x.md": line });
		expect(scanForGateAuthority(root, ".claude/rules/x.md")).toEqual([]);
	});

	it("flags an asserting clause even when a contract-stating clause shares the line", async () => {
		const root = await projectWith({
			".claude/modes/x.md": "Gate 2 is never auto-approved in default mode, but fast mode auto-approves Gate 2 when tests pass.",
		});
		expect(scanForGateAuthority(root, ".claude/modes/x.md")).toHaveLength(1);
	});
});

describe("scanForGateAuthority — suppression marker", () => {
	it("suppresses a line carrying the marker", async () => {
		const root = await projectWith({
			".claude/rules/gate-rules.md": "- Any mode that auto-approves Gate 1 or Gate 2 <!-- lint-allow-gate-authority -->",
		});
		expect(scanForGateAuthority(root, ".claude/rules/gate-rules.md")).toEqual([]);
	});

	it("suppresses via a marker on the preceding line", async () => {
		const root = await projectWith({
			".claude/rules/gate-rules.md": ["<!-- lint-allow-gate-authority -->", "- Any mode that auto-approves Gate 1 or Gate 2"].join("\n"),
		});
		expect(scanForGateAuthority(root, ".claude/rules/gate-rules.md")).toEqual([]);
	});

	it("suppresses only the marked line, not the rest of the file", async () => {
		const root = await projectWith({
			".claude/rules/gate-rules.md": [
				"- Any mode that auto-approves Gate 1 or Gate 2 <!-- lint-allow-gate-authority -->",
				"Fast auto-approves Gate 2 if tests pass.",
			].join("\n"),
		});
		const found = scanForGateAuthority(root, ".claude/rules/gate-rules.md");
		expect(found).toHaveLength(1);
		expect(found[0].line).toBe(2);
	});
});

describe("checkGateAuthority", () => {
	it("passes a clean tree", async () => {
		const root = await projectWith({
			".claude/rules/gate-rules.md": "Gate 2 is never auto-approved.",
			".claude/modes/default.md": "Both modes require human approval at both gates.",
		});
		const [result] = checkGateAuthority(root);
		expect(result.status).toBe("pass");
		expect(result.section).toBe("Gates");
	});

	// The mutation test the contract turns on: reintroducing a forbidden phrase
	// must fail the check. A lint that passes on the regression it exists to
	// catch is worse than no lint — it certifies the regression.
	it("fails when a forbidden phrase is reintroduced", async () => {
		const clean = { ".claude/rules/gate-rules.md": "Gate 2 is never auto-approved." };
		expect(checkGateAuthority(await projectWith(clean))[0].status).toBe("pass");

		const mutated = await projectWith({
			...clean,
			".claude/modes/fast.md": "Fast auto-approves Gate 2 if tests pass.",
		});
		const [result] = checkGateAuthority(mutated);
		expect(result.status).toBe("fail");
		expect(result.detail).toContain(".claude/modes/fast.md:1");
	});

	it("scans nested skill trees, not just top-level files", async () => {
		const root = await projectWith({
			".claude/skills/autobuild/step-05-iterate-or-ship.md": "- Gate 2 review verdict satisfied (the evaluator stamp counts)",
		});
		const [result] = checkGateAuthority(root);
		expect(result.status).toBe("fail");
		expect(result.detail).toContain("step-05-iterate-or-ship.md:1");
	});

	it("aggregates every violation into one finding", async () => {
		const root = await projectWith({
			".claude/modes/a.md": "Fast auto-approves Gate 2 if tests pass.",
			".claude/modes/b.md": "Gate 1: Auto (validated)",
		});
		const [result] = checkGateAuthority(root);
		expect(result.name).toContain("(2)");
	});

	// Same detector, different tree — this is how canonical↔plugin parity is proven.
	it("scans an arbitrary tree via scanDirs", async () => {
		const root = await projectWith({ "plugin/modes/default.md": "Fast auto-approves Gate 2 if tests pass." });
		const [result] = checkGateAuthority(root, { scanDirs: ["plugin"] });
		expect(result.status).toBe("fail");
	});

	it("fails when the scan target is absent", async () => {
		const root = await projectWith({ "README.md": "no claude tree here" });
		const [result] = checkGateAuthority(root);
		expect(result.status).toBe("fail");
		expect(result.detail).toContain("No scan target");
	});

	it("can downgrade an absent scan target to a warning", async () => {
		const root = await projectWith({ "README.md": "no claude tree here" });
		const [result] = checkGateAuthority(root, { missingRootSeverity: "warn" });
		expect(result.status).toBe("warn");
	});
});
