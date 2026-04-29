// Tests for mewkit-specific additions to md-strip (CLI verb rewrites + slash refs).
import { describe, expect, it } from "vitest";
import { stripClaudeRefs } from "../converters/md-strip.js";

describe("stripClaudeRefs — mewkit additions", () => {
	it("rewrites mewkit init to provider-neutral phrasing", () => {
		const { content } = stripClaudeRefs("Run mewkit init to set up.", { provider: "cursor" });
		expect(content.toLowerCase()).toContain("scaffold the kit");
		expect(content.toLowerCase()).not.toContain("mewkit init");
	});

	it("rewrites npx mewkit migrate", () => {
		const { content } = stripClaudeRefs("Run npx mewkit migrate to export.", { provider: "cursor" });
		expect(content.toLowerCase()).toContain("migrate the kit");
	});

	it("rewrites meowkit <verb> generically", () => {
		const { content } = stripClaudeRefs("Run meowkit upgrade for updates.", { provider: "cursor" });
		expect(content.toLowerCase()).toContain("kit upgrade");
	});

	it("strips /meow: slash command refs", () => {
		const { content } = stripClaudeRefs("Use /meow:cook to start.", { provider: "cursor" });
		expect(content).not.toContain("/meow:cook");
	});

	it("strips /mk: shortform slash refs", () => {
		const { content } = stripClaudeRefs("Try /mk:plan first.", { provider: "cursor" });
		expect(content).not.toContain("/mk:plan");
	});

	it("preserves real filesystem paths (e.g. /src/app.ts)", () => {
		const { content } = stripClaudeRefs("Edit /src/app.ts for changes.", { provider: "cursor" });
		expect(content).toContain("/src/app.ts");
	});

	it("preserves mewkit slash refs inside code blocks", () => {
		const input = "Try this:\n```\n/meow:cook\n```\nEnd.";
		const { content } = stripClaudeRefs(input, { provider: "cursor" });
		expect(content).toContain("/meow:cook");
	});

	it("rewrites .claude/agents/ paths to provider-specific paths", () => {
		const { content } = stripClaudeRefs("See .claude/agents/scout.md", { provider: "cursor" });
		expect(content).not.toContain(".claude/agents/");
	});

	it("replaces CLAUDE.md with provider config target", () => {
		const { content } = stripClaudeRefs("See CLAUDE.md for details.", { provider: "cursor" });
		expect(content).not.toContain("CLAUDE.md");
	});

	it("warns when content is empty after stripping", () => {
		const { warnings } = stripClaudeRefs("/meow:cook", { provider: "cursor" });
		// The slash command alone strips to nothing
		expect(warnings.some((w) => /Claude-specific/.test(w))).toBe(true);
	});

	it("respects max content size guard", () => {
		const huge = "x".repeat(600_000);
		const { content, warnings } = stripClaudeRefs(huge, { provider: "cursor" });
		expect(content).toBe(huge);
		expect(warnings.some((w) => /exceeds.*chars/.test(w))).toBe(true);
	});
});
