import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
	codexCommandSkillDirName,
	convertCommandToCodexSkill,
	detectDynamicCommandSyntax,
} from "../converters/command-to-codex-skill.js";
import { discoverCommands } from "../discovery/index.js";
import { getPortableInstallPath } from "../provider-registry-utils.js";
import type { PortableItem } from "../types.js";

const fixtureRoot = fileURLToPath(new URL("./fixtures/codex-full-surface/.claude", import.meta.url));

let fixCommand: PortableItem;

beforeAll(async () => {
	const commands = await discoverCommands(join(fixtureRoot, "commands"));
	const found = commands.find((c) => c.name === "mk/fix");
	if (!found) throw new Error("fixture command 'mk/fix' not discovered");
	fixCommand = found;
});

describe("codex command skill naming", () => {
	it("flattens nested command names into a skill directory slug", () => {
		expect(codexCommandSkillDirName("mk/fix")).toBe("source-command-mk-fix");
		expect(codexCommandSkillDirName("Docs:Init")).toBe("source-command-docs-init");
		expect(codexCommandSkillDirName("")).toBe("source-command-unnamed");
	});

	it("never collides a nested name with a flat hyphenated name", () => {
		// "/" and "-" must encode differently or two commands would silently
		// share one install directory.
		expect(codexCommandSkillDirName("mk/fix")).not.toBe(codexCommandSkillDirName("mk-fix"));
		expect(codexCommandSkillDirName("mk-fix")).toBe("source-command-mk--fix");
		expect(codexCommandSkillDirName("a-b/c-d")).toBe("source-command-a--b-c--d");
	});

	it("resolves the install path to the skill directory SKILL.md", () => {
		expect(getPortableInstallPath("mk/fix", "codex", "commands", { global: false })).toBe(
			join(".agents/skills", "source-command-mk-fix", "SKILL.md"),
		);
	});
});

describe("dynamic command syntax detection", () => {
	it("detects each unsupported construct", () => {
		expect(detectDynamicCommandSyntax("run $ARGUMENTS now")).toContain("$ARGUMENTS placeholder");
		expect(detectDynamicCommandSyntax("scope is $1")).toContain("positional $1–$9 placeholders");
		expect(detectDynamicCommandSyntax("value {{issue.id}}")).toContain("{{...}} template variables");
		expect(detectDynamicCommandSyntax("check !`git status`")).toContain("inline !`command` execution");
		expect(detectDynamicCommandSyntax("open @src/main.ts before starting")).toContain("@file references");
	});

	it("returns empty for a static template", () => {
		expect(detectDynamicCommandSyntax("Just follow the checklist below.")).toEqual([]);
	});
});

describe("convertCommandToCodexSkill", () => {
	it("emits a valid SKILL.md with required frontmatter and skill-dir filename", () => {
		const result = convertCommandToCodexSkill(fixCommand);
		expect(result.filename).toBe("source-command-mk-fix/SKILL.md");
		expect(result.content).toMatch(/^---\nname: source-command-mk-fix\ndescription: "[^"]+"\n---\n/);
		expect(result.content).toContain("# Command template: mk/fix");
	});

	it("keeps dynamic syntax verbatim and emits a manual-adaptation warning", () => {
		const result = convertCommandToCodexSkill(fixCommand);
		expect(result.content).toContain("$ARGUMENTS");
		expect(result.content).toContain("`$1`");
		expect(result.warnings.some((w) => w.includes("manual adaptation needed"))).toBe(true);
	});

	it("renders allowed-tools and argument-hint as guidance text with a warning", () => {
		const result = convertCommandToCodexSkill(fixCommand);
		expect(result.content).toContain("## Usage guidance");
		expect(result.content).toContain("Expected arguments: `[issue-id]`");
		expect(result.content).toContain("Originally restricted to these tools:");
		expect(result.warnings.some((w) => w.includes("no skill equivalent"))).toBe(true);
	});

	it("routes body references through the reference rewriter", () => {
		const result = convertCommandToCodexSkill(fixCommand);
		// Inline rules refs point at the merged instruction file; fenced unmapped
		// runtime commands stay preserved instead of being fabricated.
		expect(result.content).toContain("following AGENTS.md");
		expect(result.content).toContain("node .claude/scripts/scan.cjs $ARGUMENTS");
		expect(result.content).not.toContain(".codex/scripts/");
	});

	it("produces output free of toolkit branding", () => {
		const result = convertCommandToCodexSkill(fixCommand);
		expect(result.content).not.toMatch(/MeowKit|mewkit|meowkit/);
	});
});
