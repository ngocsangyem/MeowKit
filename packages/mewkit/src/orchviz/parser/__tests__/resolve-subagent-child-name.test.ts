/**
 * Unit tests for resolveSubagentChildName — probe order, normalization, fallback.
 *
 * Lives in parser/__tests__ alongside handle-tool-use.test.ts to keep related
 * subagent-naming tests together, even though the function lives in constants.ts.
 */

import { describe, it, expect } from "vitest";
import { resolveSubagentChildName } from "../../constants.js";

describe("resolveSubagentChildName — probe order", () => {
	it("returns description when present", () => {
		expect(resolveSubagentChildName({ description: "research auth", subagent_type: "researcher" })).toBe(
			"research auth",
		);
	});

	it("returns subagent_type when description empty", () => {
		expect(resolveSubagentChildName({ subagent_type: "researcher" })).toBe("researcher");
	});

	it("returns agentType when description and subagent_type empty (sidecar shape)", () => {
		expect(resolveSubagentChildName({ agentType: "scout" })).toBe("scout");
	});

	it("returns prompt prefix when description/subagent_type/agentType all empty", () => {
		const longPrompt = "x".repeat(60);
		const result = resolveSubagentChildName({ prompt: longPrompt });
		expect(result.length).toBeLessThanOrEqual(30);
		expect(result).toBe("x".repeat(30));
	});

	it("returns subagent-<id6> when all fields empty AND toolUseId.length > 6", () => {
		expect(resolveSubagentChildName({}, "toolu_abcdef123456")).toBe("subagent-123456");
	});

	it("returns plain 'subagent' when all fields empty AND toolUseId is short", () => {
		expect(resolveSubagentChildName({}, "abc")).toBe("subagent");
	});

	it("returns plain 'subagent' when all fields empty AND toolUseId is undefined", () => {
		expect(resolveSubagentChildName({})).toBe("subagent");
	});
});

describe("resolveSubagentChildName — normalization", () => {
	it("strips ANSI escapes", () => {
		expect(resolveSubagentChildName({ description: "\x1b[1mFoo\x1b[0m" })).toBe("Foo");
	});

	it("collapses newlines and tabs to single spaces", () => {
		expect(resolveSubagentChildName({ description: "foo\nbar\t" })).toBe("foo bar");
	});

	it("trims surrounding whitespace", () => {
		expect(resolveSubagentChildName({ description: "  foo  " })).toBe("foo");
	});

	it("normalized 'foo\\nbar' equals normalized 'foo bar' (dedup-key parity)", () => {
		const a = resolveSubagentChildName({ description: "foo\nbar" });
		const b = resolveSubagentChildName({ description: "foo bar" });
		expect(a).toBe(b);
	});
});
