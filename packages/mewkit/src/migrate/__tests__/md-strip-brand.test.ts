// Brand-prose neutralization tests for stripClaudeRefs.
// Covers: target-aware substitution, citation skip rules, code-block skip, multi-target goldens.
import { describe, expect, it } from "vitest";
import { stripClaudeRefs } from "../converters/md-strip.js";

describe("stripClaudeRefs — narrative brand prose", () => {
	describe("MeowKit → the toolkit", () => {
		it("replaces narrative MeowKit in body prose", () => {
			const input = "MeowKit ships with sane defaults.";
			const { content } = stripClaudeRefs(input, { provider: "codex" });
			expect(content).toContain("the toolkit ships with sane defaults");
			expect(content).not.toContain("MeowKit");
		});

		it("preserves MeowKit inside fenced code blocks", () => {
			const input = "Run:\n```\necho MeowKit\n```\nThanks.";
			const { content } = stripClaudeRefs(input, { provider: "codex" });
			expect(content).toContain("echo MeowKit");
		});

		it("does not touch the `mewkit` CLI verb (lowercase identifier)", () => {
			const input = "Use mewkit migrate today.";
			const { content } = stripClaudeRefs(input, { provider: "codex" });
			// CLI gets rewritten by existing mewkitCliReplacements; identifier itself is not "MeowKit"
			expect(content).not.toContain("MeowKit");
		});
	});

	describe("Claude Code → target-aware substitution", () => {
		it("substitutes 'Claude Code' with the Codex displayName for codex target", () => {
			const input = "Claude Code does NOT export $CLAUDE_MODEL.";
			const { content } = stripClaudeRefs(input, { provider: "codex", targetName: "Codex" });
			expect(content).toContain("Codex does NOT export");
			expect(content).not.toContain("Claude Code");
		});

		it("substitutes 'Claude Code' with the Kiro displayName for kiro target", () => {
			const input = "Tested on Claude Code.";
			const { content } = stripClaudeRefs(input, { provider: "kiro", targetName: "Kiro IDE" });
			expect(content).toContain("Tested on Kiro IDE");
		});

		it("substitutes 'Claude Code' with the Cursor displayName for cursor target", () => {
			const input = "Compatible with Claude Code.";
			const { content } = stripClaudeRefs(input, { provider: "cursor", targetName: "Cursor" });
			expect(content).toContain("Compatible with Cursor");
		});

		it("falls back to 'the host runtime' when targetName is unset", () => {
			const input = "Claude Code handles hooks.";
			const { content } = stripClaudeRefs(input, { provider: "codex" });
			expect(content).toContain("the host runtime handles hooks");
		});

		it("preserves 'Claude Code' inside fenced code blocks", () => {
			const input = "Example:\n```\nClaude Code\n```\nEnd.";
			const { content } = stripClaudeRefs(input, { provider: "codex", targetName: "Codex" });
			expect(content).toContain("Claude Code");
		});
	});

	describe("non-citation Anthropic → runtime contract", () => {
		it("rewrites 'per Anthropic's documented behavior'", () => {
			const input = "Files are wiped per Anthropic's documented behavior.";
			const { content } = stripClaudeRefs(input, { provider: "codex" });
			expect(content).toContain("per the runtime's plugin contract");
			expect(content).not.toContain("per Anthropic's documented behavior");
		});

		it("rewrites 'per Anthropic field report'", () => {
			const input = "Confirmed per Anthropic field report from 2025.";
			const { content } = stripClaudeRefs(input, { provider: "codex" });
			expect(content).toContain("per the runtime's plugin contract");
		});

		it("preserves Anthropic in research-citation context (keyword window)", () => {
			const input = [
				"Per Anthropic's harness research, dead weight degrades capable models.",
				"This is referenced widely.",
			].join("\n");
			const { content } = stripClaudeRefs(input, { provider: "codex" });
			expect(content).toContain("Anthropic");
		});

		it("preserves Anthropic when explicit <!-- research-citation --> marker is nearby", () => {
			const input = [
				"<!-- research-citation -->",
				"Anthropic's published guidance suggests minimizing wrappers.",
			].join("\n");
			const { content } = stripClaudeRefs(input, { provider: "codex" });
			expect(content).toContain("Anthropic");
		});

		it("preserves Anthropic in a blockquote citation line", () => {
			const input = "> Anthropic's field report on harness density.";
			const { content } = stripClaudeRefs(input, { provider: "codex" });
			expect(content).toContain("Anthropic");
		});
	});

	describe("multi-target goldens", () => {
		// Citation block intentionally separated from non-citation prose by a section
		// header so the ±2 line citation-skip window does not bleed into the body.
		const source = [
			"# Notes",
			"",
			"MeowKit runs on Claude Code today.",
			"Behavior changes per Anthropic's documented behavior.",
			"",
			"## Sources",
			"",
			"",
			"<!-- research-citation -->",
			"See Anthropic's harness research for context.",
		].join("\n");

		it("codex golden", () => {
			const { content } = stripClaudeRefs(source, { provider: "codex", targetName: "Codex" });
			expect(content).toContain("the toolkit runs on Codex today");
			expect(content).toContain("per the runtime's plugin contract");
			expect(content).toContain("Anthropic's harness research");
		});

		it("kiro golden", () => {
			const { content } = stripClaudeRefs(source, { provider: "kiro", targetName: "Kiro IDE" });
			expect(content).toContain("the toolkit runs on Kiro IDE today");
			expect(content).toContain("per the runtime's plugin contract");
			expect(content).toContain("Anthropic's harness research");
		});

		it("cursor golden", () => {
			const { content } = stripClaudeRefs(source, { provider: "cursor", targetName: "Cursor" });
			expect(content).toContain("the toolkit runs on Cursor today");
			expect(content).toContain("per the runtime's plugin contract");
			expect(content).toContain("Anthropic's harness research");
		});
	});
});
