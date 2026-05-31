// Unit test for parseHookCommands — confirms it reads the real settings.json and
// resolves the configured interpreter + script per event/matcher. Guards the parse
// layer independently of actually spawning hooks (that is the integration suite).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseHookCommands } from "../hook-runner.js";

const SETTINGS = JSON.parse(readFileSync(resolve(process.cwd(), ".claude/settings.json"), "utf8"));

describe("parseHookCommands", () => {
	it("returns gate-enforcement + privacy-block for a PreToolUse Write", () => {
		const cmds = parseHookCommands(SETTINGS, "PreToolUse", "Write");
		const scripts = cmds.map((c) => c.script);
		expect(scripts).toContain("gate-enforcement.sh");
		expect(scripts).toContain("privacy-block.sh");
	});

	it("invokes those safety hooks with bash, not sh", () => {
		const cmds = parseHookCommands(SETTINGS, "PreToolUse", "Write");
		const gate = cmds.find((c) => c.script === "gate-enforcement.sh");
		const privacy = cmds.find((c) => c.script === "privacy-block.sh");
		expect(gate?.interpreter).toBe("bash");
		expect(privacy?.interpreter).toBe("bash");
	});

	it("matches the Read group for a Read tool (privacy-block only, no gate)", () => {
		const cmds = parseHookCommands(SETTINGS, "PreToolUse", "Read");
		const scripts = cmds.map((c) => c.script);
		expect(scripts).toContain("privacy-block.sh");
		expect(scripts).not.toContain("gate-enforcement.sh");
	});

	it("matches the Bash group for a Bash tool (pre-task-check present)", () => {
		const cmds = parseHookCommands(SETTINGS, "PreToolUse", "Bash");
		expect(cmds.map((c) => c.script)).toContain("pre-task-check.sh");
	});

	it("returns [] for an unknown event", () => {
		expect(parseHookCommands(SETTINGS, "NoSuchEvent", "Write")).toEqual([]);
	});
});
