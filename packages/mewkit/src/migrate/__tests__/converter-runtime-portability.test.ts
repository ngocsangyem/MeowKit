import { describe, expect, it } from "vitest";
import { convertFmToCodexToml } from "../converters/fm-to-codex-toml.js";
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

});
