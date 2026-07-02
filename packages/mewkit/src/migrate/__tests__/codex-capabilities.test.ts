import { describe, expect, it } from "vitest";
import { CODEX_CAPABILITY_TABLE } from "../codex-capabilities.js";

describe("codex capabilities", () => {
	it("leads with the verified 10-event hook surface (hooks enabled by default)", () => {
		const head = CODEX_CAPABILITY_TABLE[0];
		expect(head.version).toBe("0.142.0");
		expect(head.requiresFeatureFlag).toBe(false);
		expect(Object.keys(head.events).sort()).toEqual(
			[
				"PermissionRequest",
				"PostCompact",
				"PostToolUse",
				"PreCompact",
				"PreToolUse",
				"SessionStart",
				"SubagentStart",
				"SubagentStop",
				"Stop",
				"UserPromptSubmit",
			].sort(),
		);
		expect(head.events.SessionStart.allowedMatchers).toEqual(["startup", "resume"]);
		expect(head.events.PreToolUse.allowedMatchers).toEqual(["Bash"]);
	});

	it("keeps the conservative v0.124.0-alpha.3 entry as the unknown-version fallback", () => {
		const fallback = CODEX_CAPABILITY_TABLE[CODEX_CAPABILITY_TABLE.length - 1];
		expect(fallback.version).toBe("0.124.0-alpha.3");
		expect(fallback.requiresFeatureFlag).toBe(true);
		expect(fallback.sessionStartMatchersOnly).toEqual(["startup", "resume"]);
		expect(fallback.events.SubagentStart).toBeUndefined();
	});
});
