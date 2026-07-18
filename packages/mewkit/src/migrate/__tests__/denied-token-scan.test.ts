import { describe, expect, it } from "vitest";
import { scanDeniedTokens, hasDeniedTokens } from "../denied-token-scan.js";
import { applyCodexAdapters, CODEX_SKILL_ADAPTERS } from "../providers/codex/adapter-map.js";

describe("denied-token-scan", () => {
	it("detects each Claude-Code-bound token class", () => {
		const labels = (s: string) => scanDeniedTokens(s).map((m) => m.label);
		expect(labels("run /mk:cook now")).toContain("mk/meow slash command");
		expect(labels("use the AskUserQuestion tool")).toContain("AskUserQuestion tool");
		expect(labels("read .claude/rules/x.md")).toContain(".claude path");
		expect(labels("see CLAUDE.md")).toContain("CLAUDE.md reference");
		expect(labels("call Task( to spawn")).toContain("Task( tool call");
		expect(labels("spawn a subagent")).toContain("subagent primitive");
		expect(labels("$CLAUDE_PROJECT_DIR")).toContain("Claude env var");
		expect(labels("$ANTHROPIC_API_KEY")).toContain("Anthropic env var");
	});

	it("returns clean for portable content", () => {
		const clean = "Run the review skill. Read the project rules. Ask the user in chat.";
		expect(scanDeniedTokens(clean)).toEqual([]);
		expect(hasDeniedTokens(clean)).toBe(false);
	});

	it("does not false-positive on incidental words", () => {
		// "task" (lowercase, no paren) and "claude" in prose are not denied tokens.
		expect(hasDeniedTokens("this is a task about claude models")).toBe(false);
	});
});

describe("codex adapter-map projection", () => {
	it("applyCodexAdapters removes ALL denied tokens (projection is clean)", () => {
		const dirty = [
			"Run /mk:cook and /meow:review.",
			"Use AskUserQuestion for input.",
			"Read .claude/skills/x/SKILL.md and CLAUDE.md.",
			"Call Task( to spawn a subagent (or subagents).",
			"Env: $CLAUDE_PROJECT_DIR and $ANTHROPIC_API_KEY.",
		].join("\n");
		const adapted = applyCodexAdapters(dirty);
		expect(scanDeniedTokens(adapted), `adapted output still has denied tokens: ${adapted}`).toEqual([]);
	});

	it("skill-adapter table is empty this phase (cohort-1 ports to portable, not adapter)", () => {
		expect(Object.keys(CODEX_SKILL_ADAPTERS)).toEqual([]);
	});
});
