import { describe, expect, it } from "vitest";
import { CODEX_CAPABILITY_TABLE } from "../codex-capabilities.js";

describe("codex capabilities", () => {
	it("uses the conservative v0.124.0-alpha.3 hook baseline", () => {
		const baseline = CODEX_CAPABILITY_TABLE[0];
		expect(baseline.version).toBe("0.124.0-alpha.3");
		expect(baseline.sessionStartMatchersOnly).toEqual(["startup", "resume"]);
		expect(baseline.requiresFeatureFlag).toBe(true);
		expect(baseline.events.SessionStart.allowedMatchers).toEqual(["startup", "resume"]);
		expect(baseline.events.PreToolUse.allowedMatchers).toEqual(["Bash"]);
		expect(baseline.events.PostToolUse.allowedMatchers).toEqual(["Bash"]);
		expect(baseline.events.PermissionRequest.allowedMatchers).toEqual(["Bash"]);
	});
});
