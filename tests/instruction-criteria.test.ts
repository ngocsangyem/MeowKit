// The instruction-criteria checker: every mechanical criterion flags its failing fixture and
// passes its passing one, the baseline fails only on growth, and the real trees pass against
// the committed baseline.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIX = path.join(REPO, "tests", "fixtures", "instruction-criteria");
const require = createRequire(import.meta.url);

type Kind = "claude" | "codex" | "cursor";
interface Finding {
	criterion: string;
	line: number;
	text: string;
	file?: string;
}
interface Ctx {
	kind: Kind;
	pins: Map<string, string>;
}
type FileCheck = (rel: string, text: string, ctx: Ctx) => Finding[];

const { checkFile } = require("../scripts/lib/instruction-criteria-rules.cjs") as {
	checkFile: (rel: string, text: string, root: string) => Finding[];
};
const { checkHostFile, readPins } = require("../scripts/lib/instruction-criteria-host-rules.cjs") as {
	checkHostFile: FileCheck;
	readPins: (file: string) => Map<string, string>;
};
const { checkSkillFile } = require("../scripts/lib/instruction-criteria-skill-rules.cjs") as {
	checkSkillFile: FileCheck;
};
const { allowed, looseEntries, overBaseline } = require("../scripts/lib/instruction-criteria-baseline.cjs") as {
	allowed: (text: string, f: Finding) => boolean;
	looseEntries: (
		findings: Finding[],
		baseline: Record<string, Record<string, number>>,
		trees: string[],
	) => Array<{ criterion: string; file: string; recorded: number; now: number }>;
	overBaseline: (findings: Finding[], baseline: Record<string, Record<string, number>>) => Finding[];
};
const { alwaysOnFiles } = require("../scripts/check-instruction-criteria.cjs") as {
	alwaysOnFiles: (tree: string) => string[];
};

const pins = readPins(path.join(FIX, "model-pins.md"));

/** Criteria a fixture raises, with `rel` the path the checker would see inside a tree. */
function criteria(fixture: string, kind: Kind, rel = path.basename(fixture)): string[] {
	const text = fs.readFileSync(path.join(FIX, fixture), "utf8");
	const ctx = { kind, pins };
	const all = [...checkFile(rel, text, FIX), ...checkHostFile(rel, text, ctx), ...checkSkillFile(rel, text, ctx)];
	return all.filter((f) => !allowed(text, f)).map((f) => f.criterion);
}

describe("each criterion flags its failing fixture and passes its passing one", () => {
	const cases: Array<[string, string, string, Kind, string?]> = [
		["A1", "a1/fail.md", "a1/pass.md", "claude"],
		["A2", "a2/fail.md", "a2/pass.md", "claude"],
		["A5", "a5/fail.md", "a5/pass.md", "claude"],
		["A9", "a9/fail.md", "a9/pass.md", "codex"],
		["A10", "a10/bundle-fail.md", "a10/bundle-pass.md", "cursor"],
		["A10", "a10/claude-fail.md", "a10/claude-pass.md", "claude"],
		["A11", "a11/opener-fail/SKILL.md", "a11/pass/SKILL.md", "codex", "SKILL.md"],
		["A11", "a11/length-fail/SKILL.md", "a11/pass/SKILL.md", "codex", "SKILL.md"],
		["A11", "a11/listing-fail/SKILL.md", "a11/pass/SKILL.md", "claude", "SKILL.md"],
		["A12", "a12/long-skill-fail/SKILL.md", "a12/long-skill-pass/SKILL.md", "claude", "SKILL.md"],
		[
			"A12",
			"a12/contents-fail/references/long.md",
			"a12/contents-pass/references/long.md",
			"claude",
			"references/long.md",
		],
		[
			"A12",
			"a12/chain-fail/references/first.md",
			"a12/chain-pass/references/first.md",
			"claude",
			"references/first.md",
		],
		[
			"A13",
			"a13/fail/.codex/agents/probe.toml",
			"a13/pass/.codex/agents/probe.toml",
			"codex",
			".codex/agents/probe.toml",
		],
		["A14", "a14/reverify-fail.md", "a14/pass.md", "claude"],
		["A14", "a14/delegate-fail.md", "a14/pass.md", "claude"],
	];
	for (const [criterion, fail, pass, kind, rel] of cases) {
		it(`${criterion}: ${fail} fails, ${pass} passes`, () => {
			expect(criteria(fail, kind, rel)).toContain(criterion);
			expect(criteria(pass, kind, rel)).not.toContain(criterion);
		});
	}

	it("A9 is a bundle criterion: Claude Code may use its own tools", () => {
		expect(criteria("a9/fail.md", "claude")).not.toContain("A9");
	});

	it("A9 lets Cursor name its Task tool but not Codex", () => {
		expect(criteria("a9-task-tool/text.md", "codex")).toContain("A9");
		expect(criteria("a9-task-tool/text.md", "cursor")).not.toContain("A9");
	});

	it("A11 and the listing limit read Claude Code when_to_use only on Claude Code", () => {
		expect(criteria("a11/listing-fail/SKILL.md", "codex", "SKILL.md")).not.toContain("A11");
	});

	it("A13 strips Cursor option suffixes before the pin lookup", () => {
		expect(criteria("a13/cursor-pass/.cursor/agents/probe.md", "cursor", ".cursor/agents/probe.md")).not.toContain(
			"A13",
		);
	});

	it("A9 flags every token class in the shared list", () => {
		for (const name of ["exit-plan", "claude-path", "claude-md", "slash", "ask", "skill-tool", "env"]) {
			expect(criteria(`a9-tokens/${name}.md`, "cursor"), name).toContain("A9");
		}
	});

	it("A11 reads a block-scalar description across a blank line", () => {
		expect(criteria("a11/block-blank-fail/SKILL.md", "codex", "SKILL.md")).toContain("A11");
	});

	it("A11 does not read I/O as a first-person opener", () => {
		expect(criteria("a11/io-pass/SKILL.md", "codex", "SKILL.md")).not.toContain("A11");
	});

	it("A12 allows exactly 500 SKILL.md lines and a 100-line reference without contents", () => {
		expect(criteria("a12/long-skill-boundary/SKILL.md", "claude", "SKILL.md")).not.toContain("A12");
		expect(criteria("a12/contents-boundary/references/long.md", "claude", "references/long.md")).not.toContain("A12");
	});

	it("A12 compares reference names whole, and ignores links out of the skill", () => {
		expect(criteria("a12/chain-suffix-fail/references/a.md", "claude", "references/a.md")).toContain("A12");
		expect(criteria("a12/chain-docs-link-pass/references/a.md", "claude", "references/a.md")).not.toContain("A12");
	});

	it("A13 fails a model missing from the pins and one marked not listed", () => {
		const rel = ".codex/agents/probe.toml";
		expect(criteria("a13/unknown-fail/.codex/agents/probe.toml", "codex", rel)).toContain("A13");
		expect(criteria("a13/not-listed-fail/.codex/agents/probe.toml", "codex", rel)).toContain("A13");
	});

	it("A13 drops a trailing TOML comment", () => {
		expect(criteria("a13/comment-pass/.codex/agents/probe.toml", "codex", ".codex/agents/probe.toml")).not.toContain(
			"A13",
		);
	});

	it("A14 treats 'for every' as no condition and skips a line that forbids delegating", () => {
		expect(criteria("a14/delegate-for-fail.md", "claude")).toContain("A14");
		expect(criteria("a14/negation-pass.md", "claude")).not.toContain("A14");
	});

	it("a criteria-allow comment waives that criterion on its line", () => {
		expect(criteria("a14/allowed.md", "claude")).not.toContain("A14");
	});
});

describe("baseline", () => {
	const finding = (file: string): Finding => ({ criterion: "A14", line: 1, text: "x", file });

	it("passes a file at or under its recorded count and fails one that grew", () => {
		const baseline = { A14: { "a.md": 2 } };
		expect(overBaseline([finding("a.md"), finding("a.md")], baseline)).toHaveLength(0);
		expect(overBaseline([finding("a.md"), finding("a.md"), finding("a.md")], baseline)).toHaveLength(3);
		expect(overBaseline([finding("b.md")], baseline)).toHaveLength(1);
	});

	it("reports an entry the trees no longer reach, so the baseline ratchets down", () => {
		const loose = looseEntries([finding("t/a.md")], { A14: { "t/a.md": 3, "u/b.md": 1 } }, ["t"]);
		expect(loose).toEqual([{ criterion: "A14", file: "t/a.md", recorded: 3, now: 1 }]);
	});

	it("never baselines the always-on ceiling or the pinned text", () => {
		const a8: Finding = { criterion: "A8", line: 0, text: "x", file: ".claude" };
		expect(overBaseline([a8], { A8: { ".claude": 5 } })).toHaveLength(1);
	});
});

describe("the real trees", () => {
	it("count Cursor rules marked alwaysApply as always-on", () => {
		const files = alwaysOnFiles("kit/bundles/cursor/root").map((f) => path.basename(f));
		expect(files).toContain("runtime-invariants.mdc");
		expect(files).not.toContain("domain-planning.mdc");
	});

	it("sum the Cursor always-on bytes to the A8 ceiling", () => {
		const bytes = alwaysOnFiles("kit/bundles/cursor/root").reduce((n, f) => n + fs.statSync(f).size, 0);
		expect(bytes).toBeLessThanOrEqual(6356);
	});

	it("reject a baseline flag with no file", () => {
		const run = spawnSync(process.execPath, ["scripts/check-instruction-criteria.cjs", "--baseline"], {
			cwd: REPO,
			encoding: "utf8",
		});
		expect(run.status).toBe(2);
	});

	it("pass against the committed baseline", () => {
		const run = spawnSync(
			process.execPath,
			["scripts/check-instruction-criteria.cjs", "--baseline", "scripts/instruction-criteria-baseline.json"],
			{ cwd: REPO, encoding: "utf8" },
		);
		expect(run.stdout).toContain("No findings.");
		expect(run.status).toBe(0);
	});
});
