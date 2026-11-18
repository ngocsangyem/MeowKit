// The bundle parity check: host terms fold so a faithful port compares equal, a real outline
// change or a missing file is reported, the allow-list accepts only what it names, a stale
// allow-list entry fails, and the real trees pass against the committed allow-list.
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

interface Difference {
	key: string;
	detail: string;
}
const { differences, check } = require("../scripts/check-bundle-parity.cjs") as {
	differences: (root: string) => Difference[];
	check: (root: string) => { found: Difference[]; unlisted: Difference[]; stale: string[] };
};
const { normaliseHeading } = require("../scripts/lib/bundle-parity-outline.cjs") as {
	normaliseHeading: (text: string) => string;
};

const CODEX = "kit/bundles/codex/root";
const CURSOR = "kit/bundles/cursor/root";
const roots: string[] = [];

function write(root: string, rel: string, body: string): void {
	const file = path.join(root, rel);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, body);
}

/** A tree where one skill and one agent are faithfully ported to both bundles. */
function tree(allow: Record<string, string[]> = {}): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-parity-"));
	roots.push(root);
	write(root, ".claude/skills/fix/SKILL.md", "# mk:fix\n\n## Present via AskUserQuestion\n\n```\n# not a heading\n```\n");
	write(root, `${CODEX}/.agents/skills/mk-fix/SKILL.md`, "# $mk-fix\n\n## Present by asking the user\n");
	write(root, `${CURSOR}/.cursor/skills/mk-fix/SKILL.md`, "# /mk-fix\n\n## Present by asking the user\n");
	write(root, ".claude/agents/developer.md", "---\nname: developer\n---\n## What you do\n");
	write(root, `${CODEX}/.codex/agents/developer.toml`, 'name = "developer"\ndeveloper_instructions = """\n## What you do\n"""\n');
	write(root, `${CURSOR}/.cursor/agents/developer.md`, "---\nname: developer\n---\n# Developer\n\n## What you do\n");
	write(root, "scripts/bundle-parity-allow.json", JSON.stringify({ differences: allow }));
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("heading normalisation", () => {
	it("folds each host's invocation form and the user-question tool to one token", () => {
		expect(normaliseHeading("Run `mk:fix`")).toBe(normaliseHeading("Run `$mk-fix`"));
		expect(normaliseHeading("Run /mk-fix")).toBe(normaliseHeading("Run the fix skill"));
		expect(normaliseHeading("Present via AskUserQuestion")).toBe(normaliseHeading("Present by asking the user"));
		expect(normaliseHeading("Required Subagents")).toBe(normaliseHeading("Required sub-task"));
	});
});

describe("check-bundle-parity", () => {
	it("finds nothing when every port matches after folding", () => {
		expect(differences(tree())).toEqual([]);
	});

	it("reports a changed outline, a missing file and a missing skill", () => {
		const root = tree();
		write(root, ".claude/skills/fix/references/new.md", "# New\n");
		write(root, `${CODEX}/.agents/skills/mk-fix/SKILL.md`, "# $mk-fix\n\n## Something else\n");
		write(root, ".claude/skills/arch/SKILL.md", "# arch\n");
		const keys = differences(root).map((d) => d.key);
		expect(keys).toContain("codex:outline:fix/SKILL.md");
		expect(keys).toContain("cursor:file-missing:fix/references/new.md");
		expect(keys).toContain("codex:skill-missing:arch");
	});

	it("reads a Codex agent's headings from its instruction string", () => {
		const root = tree();
		write(root, `${CODEX}/.codex/agents/developer.toml`, 'developer_instructions = """\n## Something else\n"""\n');
		expect(differences(root).map((d) => d.key)).toEqual(["codex:outline:agents/developer"]);
	});

	it("finds a rubric file the bundle keeps at host level", () => {
		const root = tree();
		write(root, ".claude/skills/rubric/rubrics/craft.md", "# Craft\n");
		for (const [bundle, host] of [[CODEX, ".agents"], [CURSOR, ".cursor"]]) {
			write(root, `${bundle}/${host}/skills/mk-rubric/.keep.md`, "");
		}
		write(root, "kit/overlays/codex/files/.codex/rubrics/craft.md", "# Craft\n");
		const keys = differences(root).map((d) => d.key);
		expect(keys).not.toContain("codex:file-missing:rubric/rubrics/craft.md");
		expect(keys).toContain("cursor:file-missing:rubric/rubrics/craft.md");
	});

	it("accepts a listed difference, fails an unlisted one and a stale entry", () => {
		const root = tree({ reason: ["*:skill-missing:arch", "codex:outline:agents/developer"] });
		write(root, ".claude/skills/arch/SKILL.md", "# arch\n");
		write(root, ".claude/skills/fix/references/new.md", "# New\n");
		const result = check(root);
		expect(result.unlisted.map((d) => d.key).sort()).toEqual([
			"codex:file-missing:fix/references/new.md",
			"cursor:file-missing:fix/references/new.md",
		]);
		expect(result.stale).toEqual(["codex:outline:agents/developer"]);
	});

	it("passes on the real trees against the committed allow-list", () => {
		const run = spawnSync(process.execPath, ["scripts/check-bundle-parity.cjs"], { cwd: REPO, encoding: "utf8" });
		expect(run.stderr).toBe("");
		expect(run.status).toBe(0);
	});
});
