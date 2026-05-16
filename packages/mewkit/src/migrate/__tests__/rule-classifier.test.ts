import { describe, expect, it } from "vitest";
import { classifyRuleSemantic } from "../ir/rule-classifier.js";

describe("rule classifier", () => {
	it("classifies orchestration rules from explicit phase/gate signals", () => {
		const classified = classifyRuleSemantic({
			name: "orchestration/review-gates",
			sourcePath: ".claude/rules/orchestration/review-gates.md",
			body: "Phase 4 requires Gate 2 approval before the orchestrator may continue.",
		});

		expect(classified.kind).toBe("orchestration");
		expect(classified.signals).toContain("phase workflow");
	});

	it("classifies hook-driven runtime rules as runtime automation", () => {
		const classified = classifyRuleSemantic({
			name: "hooks/pretooluse",
			sourcePath: ".claude/rules/hooks/pretooluse.md",
			body: "Mirror .claude/hooks/pre-tool.cjs into PreToolUse and export $CLAUDE_PROJECT_DIR.",
		});

		expect(classified.kind).toBe("runtime-automation");
	});

	it("keeps generic repo standards as policy", () => {
		const classified = classifyRuleSemantic({
			name: "engineering/standards",
			sourcePath: ".claude/rules/engineering/standards.md",
			body: "Prefer small commits, add regression tests, and keep migration output deterministic.",
		});

		expect(classified.kind).toBe("policy");
	});
});
