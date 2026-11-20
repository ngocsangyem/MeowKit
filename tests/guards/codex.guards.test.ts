// Codex guards, replayed from kit/overlays/codex/files/.codex/hooks.json: privacy on Bash
// and the ship check.
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
import { fireEvent, makeFixture, registeredHooks, runCount, runHook, scriptOf } from "./replay";

const RT = "codex" as const;

describe("codex guards (.codex/hooks.json)", () => {
	guardCase("codex: every registered PreToolUse guard has a case", () => {
		const covered = [".codex/hooks/privacy-block.cjs", ".codex/hooks/pre-ship.cjs"];
		for (const h of registeredHooks(RT).filter((h) => h.event === "PreToolUse"))
			expect(covered, `no guard case covers ${scriptOf(h)}`).toContain(scriptOf(h));
	});

	guardCase("codex: privacy blocks a command that reads .env", () => {
		expect(fireShell(makeFixture([RT]), RT, "cat .env").blocked).toBe(true);
	});

	guardCase("codex: privacy decides the shared corpus on a command naming each file", () => {
		const fx = makeFixture([RT]);
		writePrivacyCorpus(fx);
		expect(privacyMismatches(fx, (name) => fireShell(fx, RT, `cat ${name}`).blocked)).toEqual([]);
	});

	guardCase("codex: privacy allows an ordinary command", () => {
		expect(fireShell(makeFixture([RT]), RT, "ls src").blocked).toBe(false);
	});

	guardCase("codex: privacy blocks on unreadable hook input", () => {
		const fx = makeFixture([RT]);
		const hook = registeredHooks(RT).find((h) => scriptOf(h).endsWith("privacy-block.cjs"))!;
		expect(runHook(fx, hook, "{not json").blocked).toBe(true);
	});

	guardCase("codex: a source Write with no plan is allowed by every registered hook", () => {
		const fx = makeFixture([RT]);
		const r = fireEvent(
			fx,
			RT,
			"PreToolUse",
			{
				hook_event_name: "PreToolUse",
				tool_name: "Write",
				tool_input: { file_path: path.join(fx.dir, "src/new.cjs"), content: "module.exports = 1;\n" },
			},
			{ toolName: "Write" },
		);
		expect(r.blocked).toBe(false);
	});

	guardCase("codex: ship check blocks a commit that stages a lint error", () => {
		const fx = makeShipFixture([RT]);
		stageLintError(fx);
		expect(fireShell(fx, RT, "git commit -m x").blocked).toBe(true);
	});

	guardCase("codex: with no related-test mode the ship check says tests did not run", () => {
		const fx = makeShipFixture([RT]);
		useRunnerWithoutRelatedTests(fx);
		stageLintError(fx);
		const r = fireShell(fx, RT, "git commit -m x");
		expect(r.blocked).toBe(true);
		expect(shipOutput(r)).toMatch(/Tests did not run/);
		expect(runCount(fx, "test")).toBe(0);
	});

	guardCase("codex: ship check blocks a commit whose related test fails", () => {
		const fx = makeShipFixture([RT]);
		stageFailingTest(fx);
		expect(fireShell(fx, RT, "git commit -m x").blocked).toBe(true);
	});

	guardCase("codex: completion check, when on, continues a turn with unverified edits until a check passes", () => {
		const fx = makeFixture([RT]);
		fx.write(".meowkit/config.yaml", "hooks:\n  pre-completion-check: true\n");
		const ev = (event: string, extra: Record<string, unknown> = {}) =>
			fireEvent(fx, RT, event, { hook_event_name: event, session_id: "s1", ...extra }, { toolName: "Bash" });
		const stopDecision = () =>
			JSON.parse(
				ev("Stop")
					.results.map((r) => r.stdout)
					.join("")
					.trim() || "{}",
			) as { decision?: string };
		ev("SessionStart");
		fx.write("src/add.cjs", "module.exports = (a, b) => b + a;\n");
		expect(stopDecision().decision).toBe("block");
		ev("PostToolUse", { tool_name: "Bash", tool_input: { command: "npm test" }, tool_response: { exit_code: 1 } });
		expect(stopDecision().decision, "a failing run records no pass").toBe("block");
		ev("PostToolUse", { tool_name: "Bash", tool_input: { command: "npm test" }, tool_response: { exit_code: 0 } });
		expect(stopDecision().decision).toBeUndefined();
	});
});
