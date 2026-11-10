// What the published kit must still CARRY, checked against the repository.
//
// The converse of `ship-set-exclusions.test.ts`. An exclusion list is easy to get
// half right: excluding a pattern proves that pattern is handled, and proves
// nothing about whether a shipped file can still find what it reads, or whether the
// file is still in the checkout for the CI job that runs it. Those are this file's
// two claims.
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { REPO, shipSetView } from "./helpers/ship-set-view.js";

describe("ship set completeness", () => {
	const { isExcluded, tracked, shipped } = shipSetView();

	it("carries workflow.yaml, because shipped files read it", () => {
		expect(shipped).toContain(".claude/skills/workflow-orchestrator/workflow.yaml");
		const readers = execFileSync("git", ["grep", "-l", "workflow.yaml", "--", ".claude"], {
			cwd: REPO,
			encoding: "utf8",
		})
			.split("\n")
			.filter((line) => line !== "" && !line.startsWith(".claude/worktrees/"));
		expect(readers.length).toBeGreaterThan(1);
	});

	it("ships nothing under tasks/, and the templates that lived there have skill homes", () => {
		// `tasks/` used to be archived WHOLE for the sake of five templates, so
		// anything new dropped under it shipped by default — this project's own
		// contracts and phase plans were reaching every installed project that way,
		// and the pattern list that withheld them had to grow once per output kind.
		// It is no longer a root, so the whole class is structurally impossible
		// rather than filtered, and the exclusion patterns that named it are gone
		// with it. Asserted against the matcher as well as the shipped list,
		// because a pattern-based claim would now pass for the wrong reason.
		expect(shipped.filter((path) => path.startsWith("tasks/"))).toEqual([]);
		expect(isExcluded("tasks/plans/260101-x/plan.md")).toBe(false);
		// Each template is carried by the skill that reads it, at one path.
		for (const template of [
			".claude/skills/plan-creator/assets/plan-template.md",
			".claude/skills/plan-creator/assets/plan-quick.md",
			".claude/skills/plan-creator/assets/plan-phase.md",
			".claude/skills/plan-creator/assets/bead-template.md",
			".claude/skills/status/assets/pm-status-template.md",
			".claude/skills/jira-lifecycle/references/workflow-cache-layout.md",
		]) {
			expect(shipped).toContain(template);
			// One copy inside the kit tree. The hand-authored provider bundles under
			// `packages/mewkit/src/migrate/modules/` carry their own mirrors by design
			// and are not kit content, so they are outside this claim.
			const name = template.split("/").pop();
			expect(tracked.filter((path) => path.startsWith(".claude/") && path.endsWith(`/${name}`))).toEqual([template]);
		}
	});

	it("removes nothing from the repository", () => {
		// The exclusions are from the ARTIFACT. CI runs these from the checkout, so
		// excluding them from the archive must not have deleted any of them.
		for (const path of [
			".claude/eval/track-m-adapter-core.cjs",
			".claude/.brand-allowlist.txt",
			"scripts/lint-brand-prose.sh",
			".claude/skills/prompt-enhancer/eval/run-canaries.cjs",
			".claude/harness-substrate.md",
			".claude/benchmarks/README.md",
			".claude/skills/benchmark/SKILL.md",
			".claude/skills/benchmark/scripts/run-canary.sh",
		]) {
			expect(tracked).toContain(path);
		}
		expect(tracked.filter((path) => path.includes("/__tests__/")).length).toBeGreaterThan(0);
	});

	it("ships no skill without its own data", () => {
		// The failure mode a per-path exclusion creates: the SKILL.md ships, its
		// `references/` or `scripts/` does not, and the skill fails at runtime
		// reaching for a file the artifact never carried. No structural check
		// catches that, because both halves look deliberate on their own.
		const DATA_DIRS = ["references", "scripts", "assets", "data", "templates", "rubrics"];
		const shippedSkills = new Set(
			shipped.filter((path) => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(path)).map((path) => path.split("/")[2]),
		);
		const orphaned = tracked.filter((path) => {
			const parts = path.split("/");
			if (parts[0] !== ".claude" || parts[1] !== "skills" || parts.length < 5) return false;
			if (!shippedSkills.has(parts[2]!) || !DATA_DIRS.includes(parts[3]!)) return false;
			// `eval/`, `__tests__/` and `*.test.*` are excluded kit-wide by their own
			// patterns, and are a skill's verification rather than its input.
			if (path.includes("/__tests__/") || path.includes("/tests/") || /\.test\./.test(path)) return false;
			return isExcluded(path);
		});
		expect(orphaned).toEqual([]);
		// The converse: the withheld benchmark skill takes its corpus with it, so
		// nothing shipped reaches for a spec the artifact does not carry.
		expect(shippedSkills.has("benchmark")).toBe(false);
	});});
