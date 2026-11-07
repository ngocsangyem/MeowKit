// Guards `scripts/check-dangling-rule-refs.cjs`. The check is run as a real subprocess
// against synthetic trees so each of its three rules is proven to fire — a check that only
// ever passes on the real repo would be indistinguishable from one that measures nothing.
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const CHECK = path.join(REPO_ROOT, "scripts", "check-dangling-rule-refs.cjs");
const STEP_FILE_SKILLS = ["plan-creator", "review", "evaluate", "autobuild", "trace-analyze"];

/** Every moved rule's new location, so a clean fixture satisfies rule (c). */
const DESTINATIONS = [
	"skills/cook/references/harness-rules.md",
	"skills/cook/references/tdd-rules.md",
	"skills/cook/references/phase-contracts.md",
	"skills/cook/references/post-phase-delegation.md",
	"skills/cook/references/task-state-emission.md",
	"skills/cook/references/parallel-execution-rules.md",
	"skills/cook/references/orchestration-rules.md",
	"skills/agent-detector/references/model-selection-rules.md",
	"skills/agent-detector/references/scale-adaptive-rules.md",
	"skills/agent-detector/references/risk-checklist.md",
	"skills/agent-detector/references/agent-routing.md",
	"skills/agent-detector/references/context-budget-rules.md",
	"skills/rubric/references/rubric-rules.md",
	"skills/skill-creator/references/skill-authoring-rules.md",
	"skills/benchmark/references/dead-weight-audit-rules.md",
];

let temp: string | null = null;
afterEach(() => {
	if (temp) fs.rmSync(temp, { recursive: true, force: true });
	temp = null;
});

function write(root: string, rel: string, body: string): void {
	const abs = path.join(root, rel);
	fs.mkdirSync(path.dirname(abs), { recursive: true });
	fs.writeFileSync(abs, body);
}

/** A minimal repo that satisfies all three rules: destinations loaded, nothing dangling. */
function makeCleanTree(): string {
	temp = fs.mkdtempSync(path.join(os.tmpdir(), "dangling-"));
	for (const dest of DESTINATIONS) write(temp, path.join(".claude", dest), "# moved rule\n");
	// One loader file naming every new location — that is the "load step" rule (c) wants.
	// The maintainer contract's own new path is named by the checker that reads it.
	write(
		temp,
		path.join(".claude", "skills", "loader", "SKILL.md"),
		[...DESTINATIONS.map((d) => `Load \`.claude/${d}\`.`), "Reads `docs/maintainer/docs-reference-contract.md`."].join(
			"\n",
		) + "\n",
	);
	for (const skill of STEP_FILE_SKILLS) {
		write(temp, path.join(".claude", "skills", skill, "workflow.md"), "## Step-File Contract\n\n- JIT load.\n");
	}
	write(temp, "docs/maintainer/docs-reference-contract.md", "# contract\n");
	return temp;
}

function run(root: string): { status: number; output: string } {
	try {
		return { status: 0, output: execFileSync("node", [CHECK, root], { encoding: "utf8" }) };
	} catch (error) {
		const err = error as { status: number; stdout?: string; stderr?: string };
		return { status: err.status, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
	}
}

describe("check-dangling-rule-refs", () => {
	it("passes on a tree where every destination is loaded and nothing points at an old path", () => {
		const result = run(makeCleanTree());
		expect(result.status).toBe(0);
		expect(result.output).toContain("no dangling references");
	});

	it("(a) fails on an old `rules/<moved>.md` path, naming the file and line", () => {
		const root = makeCleanTree();
		write(root, path.join("docs", "guide.md"), "intro\nSee `.claude/rules/tdd-rules.md` for TDD.\n");
		const result = run(root);
		expect(result.status).toBe(1);
		expect(result.output).toContain("docs/guide.md:2");
		expect(result.output).toContain("(a) old rule path: rules/tdd-rules.md");
	});

	it("(a) exempts the destination table and tasks/, which record old paths on purpose", () => {
		const root = makeCleanTree();
		write(root, path.join("docs", "maintainer", "rule-destination-table.md"), "`rules/tdd-rules.md` moved.\n");
		write(root, path.join("tasks", "plans", "old", "plan.md"), "`rules/tdd-rules.md` is loaded.\n");
		expect(run(root).status).toBe(0);
	});

	it("(b) flags a bare mention of a merged rule inside .claude/, and accepts a full new path", () => {
		const root = makeCleanTree();
		write(root, path.join(".claude", "skills", "x", "SKILL.md"), "Read `intervention-recording-rules.md`.\n");
		const flagged = run(root);
		expect(flagged.status).toBe(1);
		expect(flagged.output).toContain("(b) bare `intervention-recording-rules.md` — merged into another file");

		fs.writeFileSync(
			path.join(root, ".claude", "skills", "x", "SKILL.md"),
			"Read `.claude/skills/cook/references/tdd-rules.md`.\n",
		);
		expect(run(root).status).toBe(0);
	});

	it("(c) fails when a destination is never loaded, or a step-filed workflow loses the inline contract", () => {
		const unloaded = makeCleanTree();
		fs.writeFileSync(path.join(unloaded, ".claude", "skills", "loader", "SKILL.md"), "nothing here\n");
		const noLoad = run(unloaded);
		expect(noLoad.status).toBe(1);
		expect(noLoad.output).toContain("(c) no load step references the new location of harness-rules");

		const root = makeCleanTree();
		fs.writeFileSync(path.join(root, ".claude", "skills", "review", "workflow.md"), "no contract here\n");
		const result = run(root);
		expect(result.status).toBe(1);
		expect(result.output).toContain("skills/review/workflow.md is missing the inlined step-file contract");
	});

	it("exits 2 on an unreadable root", () => {
		const result = run(path.join(os.tmpdir(), "no-such-meowkit-root"));
		expect(result.status).toBe(2);
		expect(result.output).toContain("cannot read");
	});
});
