// Cursor guards, replayed from kit/overlays/cursor/files/.cursor/hooks.json: read, shell, MCP
// and tool gates with the kill switch off and on, the ship check, and a project carrying
// both the Claude Code and Cursor kits.
import path from "node:path";
import { describe, expect } from "vitest";
import {
	fireShell,
	guardCase,
	makeShipFixture,
	shipOutput,
	stageFailingTest,
	stageLintError,
	useRunnerWithoutRelatedTests,
	privacyMismatches,
	writePrivacyCorpus,
} from "./cases";
import { type Fixture, fireEvent, makeFixture, registeredHooks, runCount, scriptOf } from "./replay";

const RT = "cursor" as const;
const KILL = { MEWKIT_CURSOR_HOOKS_KILL_SWITCH: "1" };
const read = (fx: Fixture, file: string, env = {}) =>
	fireEvent(
		fx,
		RT,
		"beforeReadFile",
		{ hook_event_name: "beforeReadFile", file_path: path.join(fx.dir, file) },
		{ env },
	);
const tool = (fx: Fixture, name: string, input: Record<string, unknown>) =>
	fireEvent(
		fx,
		RT,
		"preToolUse",
		{ hook_event_name: "preToolUse", tool_name: name, tool_input: input },
		{ toolName: name },
	);
const mcp = (fx: Fixture, name: string) =>
	fireEvent(fx, RT, "beforeMCPExecution", { hook_event_name: "beforeMCPExecution", tool_name: name, tool_input: {} });

describe("cursor guards (.cursor/hooks.json)", () => {
	guardCase("cursor: every registered guard has a case", () => {
		const guardEvents = ["beforeReadFile", "beforeShellExecution", "beforeMCPExecution", "preToolUse"];
		const covered = [
			".cursor/hooks/privacy-read-gate.cjs",
			".cursor/hooks/shell-gate.cjs",
			".cursor/hooks/mcp-gate.cjs",
			".cursor/hooks/tool-gate.cjs",
			".cursor/hooks/pre-ship.cjs",
		];
		for (const h of registeredHooks(RT).filter((h) => guardEvents.includes(h.event)))
			expect(covered, `no guard case covers ${scriptOf(h)}`).toContain(scriptOf(h));
	});

	guardCase("cursor: read gate denies .env", () => {
		const fx = makeFixture([RT]);
		fx.write(".env", "TOKEN=placeholder\n");
		expect(read(fx, ".env").blocked).toBe(true);
	});

	guardCase("cursor: read gate decides the shared corpus", () => {
		const fx = makeFixture([RT]);
		writePrivacyCorpus(fx);
		expect(privacyMismatches(fx, (name) => read(fx, name).blocked)).toEqual([]);
	});

	guardCase("cursor: read gate allows a source file", () => {
		expect(read(makeFixture([RT]), "src/add.cjs").blocked).toBe(false);
	});

	guardCase("cursor: read gate ignores the kill switch", () => {
		const fx = makeFixture([RT]);
		fx.write(".env", "TOKEN=placeholder\n");
		expect(read(fx, ".env", KILL).blocked).toBe(true);
	});

	guardCase("cursor: shell gate denies a destructive command", () => {
		expect(fireShell(makeFixture([RT]), RT, "rm -rf /").blocked).toBe(true);
	});

	guardCase("cursor: shell gate allows an ordinary command", () => {
		expect(fireShell(makeFixture([RT]), RT, "ls src").blocked).toBe(false);
	});

	guardCase("cursor: shell gate kill switch (env) downgrades a deny", () => {
		const fx = makeFixture([RT]);
		const r = fireEvent(
			fx,
			RT,
			"beforeShellExecution",
			{ hook_event_name: "beforeShellExecution", command: "rm -rf /" },
			{ env: KILL },
		);
		expect(r.blocked).toBe(false);
	});

	guardCase("cursor: the kill-switch flag file does not disable the shell gate", () => {
		const fx = makeFixture([RT]);
		fx.write(".meowkit/state/cursor-hooks-kill-switch", "");
		expect(fireShell(fx, RT, "rm -rf /").blocked).toBe(true);
	});

	guardCase("cursor: MCP gate denies when no allowlist is configured", () => {
		expect(mcp(makeFixture([RT]), "mcp__srv__run").blocked).toBe(true);
	});

	guardCase("cursor: MCP gate allows an allowlisted server", () => {
		const fx = makeFixture([RT]);
		fx.write(".cursor/mcp.json", JSON.stringify({ mcpServers: { srv: { command: "true" } } }));
		expect(mcp(fx, "mcp__srv__run").blocked).toBe(false);
	});

	guardCase("cursor: tool gate denies a write to .git", () => {
		expect(tool(makeFixture([RT]), "write", { path: ".git/config" }).blocked).toBe(true);
	});

	guardCase("cursor: tool gate allows a read-only tool", () => {
		expect(tool(makeFixture([RT]), "read", { path: "src/add.cjs" }).blocked).toBe(false);
	});

	guardCase("cursor: tool gate denies an unclassified tool", () => {
		expect(tool(makeFixture([RT]), "teleport", {}).blocked).toBe(true);
	});

	guardCase("cursor: a source write with no plan is allowed by every registered hook", () => {
		const fx = makeFixture([RT]);
		expect(tool(fx, "write", { path: path.join(fx.dir, "src/new.cjs") }).blocked).toBe(false);
	});

	guardCase("cursor: ship check blocks a commit that stages a lint error", () => {
		const fx = makeShipFixture([RT]);
		stageLintError(fx);
		expect(fireShell(fx, RT, "git commit -m x").blocked).toBe(true);
	});

	guardCase("cursor: with no related-test mode the ship check says tests did not run", () => {
		const fx = makeShipFixture([RT]);
		useRunnerWithoutRelatedTests(fx);
		stageLintError(fx);
		const r = fireShell(fx, RT, "git commit -m x");
		expect(r.blocked).toBe(true);
		expect(shipOutput(r)).toMatch(/Tests did not run/);
		expect(runCount(fx, "test")).toBe(0);
	});

	guardCase("cursor: ship check blocks a commit whose related test fails", () => {
		const fx = makeShipFixture([RT]);
		stageFailingTest(fx);
		expect(fireShell(fx, RT, "git commit -m x").blocked).toBe(true);
	});

	// Cursor loads Claude Code hooks by default and runs every matching hook from every
	// source, so one shell command reaches both kits' shell guards.
	guardCase("cursor+cc: a dual install runs the ship check once per command", () => {
		const fx = makeShipFixture(["claude-code", RT]);
		fx.write("src/add.cjs", "module.exports = (a, b) => b + a;\n");
		fx.git("add", "src/add.cjs");
		fireShell(fx, RT, "git commit -m x");
		fireShell(fx, "claude-code", "git commit -m x");
		expect(runCount(fx, "lint")).toBe(1);
	});

	guardCase("cursor: completion check, when on, sends a follow-up for unverified edits until a check passes", () => {
		const fx = makeFixture([RT]);
		fx.write(".meowkit/config.yaml", "hooks:\n  pre-completion-check: true\n");
		const ev = (event: string, extra: Record<string, unknown> = {}) =>
			fireEvent(fx, RT, event, { hook_event_name: event, conversation_id: "c1", ...extra });
		const followup = () =>
			ev("stop", { status: "completed", loop_count: 0 })
				.results.map((r) => r.stdout)
				.join("");
		ev("sessionStart");
		fx.write("src/add.cjs", "module.exports = (a, b) => b + a;\n");
		expect(followup()).toMatch(/followup_message/);
		ev("postToolUse", { tool_name: "Shell", tool_input: { command: "npm test" } });
		expect(followup()).not.toMatch(/followup_message/);
	});
});
