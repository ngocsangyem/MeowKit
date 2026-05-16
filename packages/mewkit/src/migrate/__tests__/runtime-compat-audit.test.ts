import { describe, expect, it } from "vitest";
import { auditRuntimeCompatibility } from "../runtime-compat-audit.js";

describe("runtime compatibility audit", () => {
	it("flags leftover .claude paths for non-Claude targets", () => {
		const result = auditRuntimeCompatibility("See .claude/agents/scout.md", { name: "scout", type: "agent" }, "cursor");
		expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining(".claude/ path reference")]));
	});

	it("flags leftover Claude env vars for non-Claude targets", () => {
		const result = auditRuntimeCompatibility(
			"export ROOT=$CLAUDE_PROJECT_DIR",
			{ name: "bootstrap", type: "hooks" },
			"droid",
		);
		expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("Claude-specific environment variable")]));
	});

	it("ignores Claude-specific content when target is claude-code", () => {
		const result = auditRuntimeCompatibility("See .claude/hooks/test.cjs", { name: "test", type: "hooks" }, "claude-code");
		expect(result.errors).toEqual([]);
	});
});
