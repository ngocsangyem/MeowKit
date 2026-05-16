import { describe, expect, it } from "vitest";
import { analyzeCodexRuleSource, convertMdToCodexRules } from "../converters/index.js";
import type { PortableItem } from "../types.js";

function makeRule(body: string): PortableItem {
	return {
		name: "engineering/rule",
		description: "rule",
		type: "rules",
		sourcePath: ".claude/rules/engineering/rule.md",
		frontmatter: {},
		body,
	};
}

describe("md-to-codex-rules", () => {
	it("passes through native Codex Starlark rules", () => {
		const item = makeRule('prefix_rule(\n    pattern = ["gh", "pr", "view"],\n    decision = "prompt",\n)\n');
		const result = convertMdToCodexRules(item);

		expect(result.error).toBeUndefined();
		expect(result.content).toContain('pattern = ["gh", "pr", "view"]');
	});

	it("translates supported Markdown policy docs into prefix_rule entries", () => {
		const item = makeRule("Prefer `rg` for code search. Use `rg` instead of `grep`.\n");
		const result = convertMdToCodexRules(item);

		expect(result.error).toBeUndefined();
		expect(result.content).toContain('pattern = ["grep"]');
		expect(result.content).toContain('decision = "forbidden"');
	});

	it("rejects mixed Markdown docs that only embed prefix_rule() examples", () => {
		const item = makeRule(["# Example", "", "```py", 'prefix_rule(pattern = ["gh"], decision = "prompt")', "```"].join("\n"));
		const analyzed = analyzeCodexRuleSource(item);

		expect(analyzed.kind).toBe("unsupported");
		expect(analyzed.reason).toContain("supported Markdown command policy");
	});
});
