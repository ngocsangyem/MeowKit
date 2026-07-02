// Generated target files must contain zero toolkit branding — no persistent
// context pollution in the user's project. This covers every codex-bound
// generator surface with brand-heavy source content.

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildMergedAgentsMd } from "../converters/fm-strip.js";
import { convertCommandToCodexSkill } from "../converters/command-to-codex-skill.js";
import { convertFmToCodexToml } from "../converters/fm-to-codex-toml.js";
import { convertMcpJsonToCodexToml } from "../converters/mcp-json-to-codex-toml.js";
import { stripClaudeRefs } from "../converters/md-strip.js";
import type { PortableItem } from "../types.js";

const BRAND = /MeowKit|mewkit|meowkit/;

const brandHeavyBody = [
	"MeowKit ships this workflow. Run `npx mewkit migrate` to port it.",
	"Also try mewkit doctor and meowkit upgrade when things break.",
].join("\n");

function makeItem(type: PortableItem["type"], name: string, body: string): PortableItem {
	return {
		name,
		description: "Brand-heavy fixture",
		type,
		sourcePath: fileURLToPath(new URL(`./fixtures/codex-full-surface/.claude`, import.meta.url)),
		frontmatter: { name, description: "Brand-heavy fixture" },
		body,
	};
}

describe("codex output is brand-free", () => {
	it("md-strip removes brand prose and CLI identifiers", () => {
		const result = stripClaudeRefs(brandHeavyBody, { provider: "codex", targetName: "Codex" });
		expect(result.content).not.toMatch(BRAND);
	});

	it("command→skill conversion emits no brand strings", () => {
		const result = convertCommandToCodexSkill(makeItem("command", "brandy", brandHeavyBody));
		expect(result.content).not.toMatch(BRAND);
	});

	it("agent TOML conversion emits no brand strings", () => {
		const result = convertFmToCodexToml(makeItem("agent", "brandy-agent", brandHeavyBody));
		expect(result.content).not.toMatch(BRAND);
	});

	it("merged AGENTS.md header emits no brand strings", () => {
		expect(buildMergedAgentsMd(["## Agent: x\n\nbody"], "Codex")).not.toMatch(BRAND);
	});

	it("MCP TOML conversion emits no brand strings", () => {
		const result = convertMcpJsonToCodexToml(JSON.stringify({ mcpServers: { a: { command: "npx" } } }));
		expect(result.content).not.toMatch(BRAND);
	});
});
