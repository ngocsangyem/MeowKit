// Claude Code guards, replayed from .claude/settings.json: privacy block and ship check.
import fs from "node:fs";
import path from "node:path";
import { describe, expect } from "vitest";
import { expectedFail, fireShell, guardCase, makeShipFixture, SHIP_EVASIONS, shipOutput, stageFailingTest, stageLintError, useRunnerWithoutRelatedTests, privacyMismatches, writePrivacyCorpus } from "./cases";
import { fireEvent, makeFixture, registeredHooks, runCount, runHook, scriptOf } from "./replay";

const RT = "claude-code" as const;
const privacyHook = () => registeredHooks(RT).find((h) => h.event === "PreToolUse" && h.matcher === "Read" && scriptOf(h).endsWith("privacy-block.cjs"))!;
const read = (fx: ReturnType<typeof makeFixture>, file: string) =>
	fireEvent(fx, RT, "PreToolUse", { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: path.join(fx.dir, file) } }, { toolName: "Read" });

describe("claude-code guards (.claude/settings.json)", () => {
	guardCase("cc: every registered PreToolUse guard has a case", () => {
		const guards = new Set(registeredHooks(RT).filter((h) => h.event === "PreToolUse").map(scriptOf));
		guards.delete(".claude/hooks/dispatch.cjs"); // observers only; covered by tests/hooks
		const covered = [".claude/hooks/privacy-block.cjs", ".claude/hooks/pre-ship.cjs"];
		for (const g of guards) expect(covered, `no guard case covers ${g}`).toContain(g);
	});

	guardCase("cc: privacy blocks a Read of .env", () => {
		const fx = makeFixture([RT]);
		fx.write(".env", "TOKEN=placeholder\n");
		expect(read(fx, ".env").blocked).toBe(true);
	});

	// A runtime that imports `.claude/settings.json` may send its own key spelling.
	const camelRead = (fx: ReturnType<typeof makeFixture>, file: string) =>
		fireEvent(fx, RT, "PreToolUse", { cwd: undefined, workspaceRoot: fx.dir, hookEventName: "preToolUse", toolName: "Read", toolInput: { filePath: path.join(fx.dir, file) } }, { toolName: "Read" });

	guardCase("cc: privacy blocks a Read of .env sent with camelCase keys", () => {
		const fx = makeFixture([RT]);
		fx.write(".env", "TOKEN=placeholder\n");
		expect(camelRead(fx, ".env").blocked).toBe(true);
		expect(camelRead(fx, "src/add.cjs").blocked).toBe(false);
	});

	guardCase("cc: ship check blocks a commit sent with camelCase keys", () => {
		const fx = makeShipFixture([RT]);
		stageLintError(fx);
		const r = fireEvent(fx, RT, "PreToolUse", { hookEventName: "preToolUse", toolName: "Bash", toolInput: { command: "git commit -m x" } }, { toolName: "Bash" });
		expect(r.blocked).toBe(true);
		expect(runCount(fx, "lint")).toBeGreaterThan(0);
	});

	guardCase("cc: privacy allows a Read of a source file", () => {
		expect(read(makeFixture([RT]), "src/add.cjs").blocked).toBe(false);
	});

	guardCase("cc: privacy blocks on unreadable hook input", () => {
		const fx = makeFixture([RT]);
		expect(runHook(fx, privacyHook(), "{not json").blocked).toBe(true);
	});

	guardCase("cc: privacy blocks when its library crashes", () => {
		const fx = makeFixture([RT]);
		fs.writeFileSync(path.join(fx.dir, ".claude/hooks/lib/core/privacy.cjs"), "throw new Error('broken install');\n");
		expect(read(fx, "src/add.cjs").blocked).toBe(true);
	});

	guardCase("cc: privacy decides the shared corpus: new names, traversal, case, symlink, near misses", () => {
		const fx = makeFixture([RT]);
		writePrivacyCorpus(fx);
		expect(privacyMismatches(fx, (name) => read(fx, name).blocked)).toEqual([]);
	});

	guardCase("cc: a source Write with no plan is allowed by every registered hook", () => {
		const fx = makeFixture([RT]);
		const r = fireEvent(fx, RT, "PreToolUse", { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: path.join(fx.dir, "src/new.cjs"), content: "module.exports = 1;\n" } }, { toolName: "Write" });
		expect(r.blocked).toBe(false);
	});

	guardCase("cc: ship check blocks a commit that stages a lint error", () => {
		const fx = makeShipFixture([RT]);
		stageLintError(fx);
		expect(fireShell(fx, RT, "git commit -m x").blocked).toBe(true);
		expect(runCount(fx, "lint")).toBeGreaterThan(0);
	});

	guardCase("cc: with no related-test mode the ship check says tests did not run", () => {
		const fx = makeShipFixture([RT]);
		useRunnerWithoutRelatedTests(fx);
		stageLintError(fx);
		const r = fireShell(fx, RT, "git commit -m x");
		expect(r.blocked).toBe(true);
		expect(shipOutput(r)).toMatch(/Tests did not run/);
		expect(runCount(fx, "test")).toBe(0);
	});

	guardCase("cc: ship check blocks a commit whose related test fails", () => {
		const fx = makeShipFixture([RT]);
		stageFailingTest(fx);
		expect(fireShell(fx, RT, "git commit -m x").blocked).toBe(true);
		expect(runCount(fx, "test")).toBeGreaterThan(0);
	});

	guardCase("cc: ship check allows a clean commit", () => {
		const fx = makeShipFixture([RT]);
		fx.write("src/add.cjs", "module.exports = (a, b) => b + a;\n");
		fx.git("add", "src/add.cjs");
		expect(fireShell(fx, RT, "git commit -m x").blocked).toBe(false);
	});

	guardCase("cc: a non-ship command runs no ship check", () => {
		const fx = makeShipFixture([RT]);
		stageLintError(fx);
		expect(fireShell(fx, RT, "git status").blocked).toBe(false);
		expect(runCount(fx, "lint")).toBe(0);
	});

	for (const command of SHIP_EVASIONS) {
		guardCase(`cc: ship check sees: ${command}`, () => {
			const fx = makeShipFixture([RT]);
			stageLintError(fx);
			expect(fireShell(fx, RT, command).blocked).toBe(true);
		});
	}
});
