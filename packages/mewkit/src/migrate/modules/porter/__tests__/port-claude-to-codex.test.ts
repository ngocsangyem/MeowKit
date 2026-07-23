import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { portAgent, portSkillMd, portAll, neutralize, flattenDescription } from "../port-claude-to-codex.js";

describe("neutralize", () => {
	it("rewrites Claude-isms and memory paths", () => {
		const out = neutralize("Use /mk:fix and read .claude/memory/fixes.json via AskUserQuestion");
		expect(out).not.toContain("/mk:fix");
		expect(out).not.toContain(".claude/memory");
		expect(out).toContain(".meowkit/memory");
		expect(out).not.toContain("AskUserQuestion");
	});

	it("leaves NO residual claude token (paths, filenames, env, product wording)", () => {
		const src = [
			"See `.claude/rules/gate-rules.md` and `.claude/scripts/bin/x`.",
			"Read CLAUDE.md. Run $CLAUDE_PROJECT_DIR/x and ${CLAUDE_PLUGIN_ROOT}.",
			"This is Claude Code; Claude's memory. plain claude and .claude/.env.",
		].join("\n");
		const out = neutralize(src);
		expect(out.toLowerCase()).not.toContain("claude");
		expect(out).toContain(".agents/skills/rule-gate-rules.md");
		expect(out).toContain("AGENTS.md");
		expect(out).toContain("$(git rev-parse --show-toplevel)");
		expect(out).toContain("PLUGIN_ROOT");
		expect(out).toContain("Codex");
	});
});

describe("portAgent", () => {
	it("emits a real Codex agent TOML with effort derived from the model tier", () => {
		const md = [
			"---",
			"name: researcher",
			"description: Research agent for libraries.",
			"model: opus",
			"runtime: claude-code",
			"---",
			"",
			"You research topics. Write findings to .claude/memory/notes.",
		].join("\n");
		const ported = portAgent(md);
		expect(ported).not.toBeNull();
		const { name, toml } = ported!;
		expect(name).toBe("researcher");
		expect(toml).toContain('name = "researcher"');
		expect(toml).toContain('description = "Research agent for libraries."');
		// model tier → Codex reasoning effort: opus/fable → xhigh, sonnet → high, haiku → medium.
		expect(toml).toContain('model_reasoning_effort = "xhigh"');
		expect(toml).toContain("developer_instructions = \"\"\"");
		expect(toml).toContain(".meowkit/memory"); // memory path rewritten
		expect(toml).not.toContain(".claude/memory");
	});

	it("omits reasoning effort for an `inherit` agent (inherits Codex's default)", () => {
		const md = ["---", "name: planner", "description: Plans work.", "model: inherit", "---", "", "You plan."].join(
			"\n",
		);
		const toml = portAgent(md)!.toml;
		expect(toml).not.toContain("model_reasoning_effort");
	});
});

describe("portSkillMd", () => {
	it("de-namespaces the skill name and flattens the description", () => {
		const md = ["---", "name: mk:advise", "description: |", "  Turn an idea", "  into advice.", "preamble-tier: 3", "---", "", "# Advise", "Body."].join("\n");
		const { name, content } = portSkillMd(md, "advise");
		expect(name).toBe("advise");
		expect(content).toContain('name: "advise"');
		expect(content).toContain('description: "Turn an idea into advice."');
		expect(content).not.toContain("preamble-tier"); // claude-only frontmatter dropped
		expect(content).toContain("# Advise");
	});
});

describe("flattenDescription", () => {
	it("collapses whitespace/newlines to a single line", () => {
		expect(flattenDescription("a\n  b   c\n")).toBe("a b c");
	});
});

describe("portAll", () => {
	let claudeDir: string;
	let outDir: string;
	beforeEach(() => {
		const root = mkdtempSync(join(tmpdir(), "porter-"));
		claudeDir = join(root, ".claude");
		outDir = join(root, "out");
		mkdirSync(join(claudeDir, "agents"), { recursive: true });
		mkdirSync(join(claudeDir, "skills", "fix", "references"), { recursive: true });
		mkdirSync(join(claudeDir, "commands"), { recursive: true });
		mkdirSync(join(claudeDir, "rules"), { recursive: true });
		writeFileSync(join(claudeDir, "agents", "planner.md"), "---\nname: planner\ndescription: Plans.\n---\nPlan it.");
		writeFileSync(join(claudeDir, "skills", "fix", "SKILL.md"), "---\nname: mk:fix\ndescription: Fix bugs.\n---\nFix with /mk:test.");
		writeFileSync(join(claudeDir, "skills", "fix", "references", "notes.md"), "See .claude/memory/fixes.json.");
		writeFileSync(join(claudeDir, "commands", "ship.md"), "---\nname: ship\ndescription: Ship it.\n---\nShip.");
		writeFileSync(join(claudeDir, "rules", "security.md"), "# Security\nNever leak secrets.");
	});
	afterEach(() => rmSync(join(claudeDir, ".."), { recursive: true, force: true }));

	it("ports every surface into the correct Codex shape", () => {
		const summary = portAll(claudeDir, outDir);
		expect(summary).toMatchObject({ agents: 1, skills: 1, commands: 1, rules: 1 });
		// Agent → .codex/agents TOML (in bundle layout: agents/<name>.toml)
		expect(existsSync(join(outDir, "agents", "planner.toml"))).toBe(true);
		// Skill → skills/<name>/SKILL.md + copied+neutralized references
		expect(readFileSync(join(outDir, "skills", "fix", "SKILL.md"), "utf-8")).toContain('name: "fix"');
		expect(readFileSync(join(outDir, "skills", "fix", "references", "notes.md"), "utf-8")).toContain(".meowkit/memory");
		// Command → prefixed skill; rule → prefixed skill
		expect(existsSync(join(outDir, "skills", "command-ship", "SKILL.md"))).toBe(true);
		expect(readFileSync(join(outDir, "skills", "rule-security", "SKILL.md"), "utf-8")).toContain('name: "rule-security"');
	});
});
