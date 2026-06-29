import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Static contract test for the terminal wiki-handoff wiring (plan 260629-wiki-handoff-
// terminal-wiring, Phases 1-3). Asserts the shipped `.claude/skills/` source — the
// canonical tree the plugin is generated from. Guards three invariants:
//   1. every wired skill invokes `wiki handoff` (suggest|propose),
//   2. every wired skill references the shared advisory file (DRY, no drift),
//   3. NO wired skill instructs a `mewkit wiki approve` command (approval stays human).
// Note: prohibition prose ("do not run `wiki approve`") legitimately contains the words
// "wiki approve" — so invariant 3 matches the COMMAND form, not the bare phrase.

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../../../.."); // __tests__→wiki→src→mewkit→packages→root
const skills = resolve(repoRoot, ".claude/skills");

const ADVISORY = resolve(skills, "wiki/references/terminal-handoff-advisory.md");
const ADVISORY_REF = "terminal-handoff-advisory";
const APPROVE_COMMAND = /(npx\s+)?mewkit\s+wiki\s+approve/;

const WIRED_FILES: { skill: string; path: string }[] = [
	{ skill: "mk:plan-creator", path: resolve(skills, "plan-creator/step-09-post-plan-handoff.md") },
	{ skill: "mk:brainstorming", path: resolve(skills, "brainstorming/SKILL.md") },
	{ skill: "mk:cook", path: resolve(skills, "cook/references/workflow-steps.md") },
	{ skill: "mk:autobuild", path: resolve(skills, "autobuild/step-06-run-report.md") },
	{ skill: "mk:review", path: resolve(skills, "review/step-04-verdict.md") },
	{ skill: "mk:fix", path: resolve(skills, "fix/SKILL.md") },
];

function read(p: string): string {
	return readFileSync(p, "utf-8");
}

describe("terminal-handoff advisory reference", () => {
	it("exists", () => {
		expect(existsSync(ADVISORY)).toBe(true);
	});

	const body = existsSync(ADVISORY) ? read(ADVISORY) : "";

	it("documents the handoff propose command and the slug-resolution contract", () => {
		expect(body).toContain("wiki handoff propose");
		expect(body).toContain("MEOWKIT_WIKI_SLUG");
	});

	it("forbids approval and never embeds an approve command", () => {
		expect(body.toLowerCase()).toContain("never");
		expect(body).not.toMatch(APPROVE_COMMAND);
	});
});

describe("wired skill terminal steps", () => {
	for (const { skill, path } of WIRED_FILES) {
		describe(skill, () => {
			it("file exists", () => {
				expect(existsSync(path)).toBe(true);
			});

			const content = existsSync(path) ? read(path) : "";

			it("invokes wiki handoff (suggest|propose)", () => {
				expect(content).toMatch(/wiki handoff (suggest|propose)/);
			});

			it("references the shared advisory file (no inlined duplicate policy)", () => {
				expect(content).toContain(ADVISORY_REF);
			});

			it("never instructs a `mewkit wiki approve` command", () => {
				expect(content).not.toMatch(APPROVE_COMMAND);
			});
		});
	}
});
