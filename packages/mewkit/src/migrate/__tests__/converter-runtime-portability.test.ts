import { describe, expect, it } from "vitest";
import { convertFmToCodexToml } from "../converters/fm-to-codex-toml.js";
import { convertFmToJson } from "../converters/fm-to-json.js";
import { convertFmToYaml } from "../converters/fm-to-yaml.js";
import { convertMdToToml } from "../converters/md-to-toml.js";
import type { PortableItem } from "../types.js";

const baseItem: PortableItem = {
	name: "analyst",
	description: "Analysis agent",
	type: "agent",
	sourcePath: ".claude/agents/analyst.md",
	frontmatter: { name: "analyst", tools: "Read,Bash", model: "haiku" },
	body: "Update CLAUDE.md, inspect .claude/memory/cost-log.json, and run /mk:budget.",
};

describe("runtime portability converters", () => {
	it("strips Claude-specific references from codex agent TOML", () => {
		const result = convertFmToCodexToml(baseItem);
		expect(result.content).not.toContain("CLAUDE.md");
		expect(result.content).not.toContain(".claude/");
		expect(result.content).not.toContain("/mk:budget");
	});

	it("strips Claude-specific references from gemini command TOML", () => {
		const result = convertMdToToml({
			...baseItem,
			type: "command",
			name: "budget",
			sourcePath: ".claude/commands/meow/budget.md",
		});
		expect(result.content).not.toContain("CLAUDE.md");
		expect(result.content).not.toContain(".claude/");
		expect(result.content).not.toContain("/mk:budget");
	});

	it("strips Claude-specific references from cline custom modes", () => {
		const result = convertFmToJson(baseItem);
		const parsed = JSON.parse(result.content) as { roleDefinition: string };
		expect(parsed.roleDefinition).not.toContain("CLAUDE.md");
		expect(parsed.roleDefinition).not.toContain(".claude/");
	});

	it("strips Claude-specific references from YAML mode exports", () => {
		const result = convertFmToYaml(baseItem);
		expect(result.content).not.toContain("CLAUDE.md");
		expect(result.content).not.toContain(".claude/");
		expect(result.content).not.toContain("/mk:budget");
	});
});
