// skill-routing-keywords.test.ts — a shortened skill description still carries the words a user
// types for its job.
//
// Each labelled prompt names the skill it should route to and the trigger words that skill's
// listing text must contain on every runtime: `description` + `when_to_use` on Claude Code, and
// `description` in an installed Codex or Cursor tree. This is a keyword check, not a routing eval;
// no model is called.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { frontmatterValue } = require("../scripts/lib/instruction-criteria-frontmatter.cjs") as {
	frontmatterValue: (text: string, key: string) => string | undefined;
};
const { installedTree } = require("../scripts/lib/installed-tree.cjs") as {
	installedTree: (runtime: string) => string;
};

interface RoutingCase {
	prompt: string;
	skill: string;
	triggers: string[];
}

const { cases } = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/skill-routing-prompts.json"), "utf8")) as {
	cases: RoutingCase[];
};

// Codex and Cursor are read as installed: the listing text a user's session gets.
const TREES = [
	{ runtime: "claude-code", dir: ".claude/skills", prefix: "", withWhen: true },
	{ runtime: "codex", dir: path.join(installedTree("codex"), ".agents/skills"), prefix: "mk-", withWhen: false },
	{ runtime: "cursor", dir: path.join(installedTree("cursor"), ".cursor/skills"), prefix: "mk-", withWhen: false },
];

function listingText(dir: string, name: string, withWhen: boolean): string | null {
	const file = path.resolve(ROOT, dir, name, "SKILL.md");
	if (!fs.existsSync(file)) return null;
	const text = fs.readFileSync(file, "utf8");
	const parts = [frontmatterValue(text, "description") ?? ""];
	if (withWhen) parts.push(frontmatterValue(text, "when_to_use") ?? "");
	return parts.join(" ").toLowerCase();
}

describe("routing fixture", () => {
	it("has 30 labelled prompts, each with trigger words", () => {
		expect(cases).toHaveLength(30);
		for (const c of cases) expect(c.triggers.length, c.prompt).toBeGreaterThan(0);
	});
});

for (const tree of TREES) {
	describe(`${tree.runtime} listing text keeps each prompt's trigger words`, () => {
		for (const c of cases) {
			const text = listingText(tree.dir, `${tree.prefix}${c.skill}`, tree.withWhen);
			// Claude Code must carry every skill in the fixture; another runtime may leave one out.
			if (text === null && tree.runtime !== "claude-code") continue;
			it(`${c.skill} ← "${c.prompt}"`, () => {
				expect(text, `${tree.dir}/${tree.prefix}${c.skill}/SKILL.md exists`).not.toBeNull();
				const missing = c.triggers.filter((t) => !text!.includes(t.toLowerCase()));
				expect(missing, `trigger words missing from ${c.skill}`).toEqual([]);
			});
		}
	});
}
