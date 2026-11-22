#!/usr/bin/env node
// Codex PreToolUse ship check (Bash matcher).
//
// A git commit, push or merge, or `gh pr create|merge`, runs the memory lint, lint on the
// changed files, the tests related to them and a project-wide type-check
// (lib/core/pre-ship.cjs, copied from .claude/hooks/lib). Any other command passes untouched.
//
// Codex hook contract: deny = stdout JSON { hookSpecificOutput: { permissionDecision: "deny" } },
// exit 0, or exit 2 with the reason on stderr. `ask`, `approve` and `continue: false` fail the
// hook and let the call through on Codex, so deny is the only blocking form used here.
//
// A failed check and a check that could not run (a crash, a missing tool, the deadline) both
// deny. With no permission prompt to hand the decision to, the could-not-run message tells the
// person to run the command in their own terminal, outside the agent. A host timeout does not
// block on Codex, which is why the checks stop at their own deadline first.
"use strict";

process.on("uncaughtException", (err) => {
	process.stderr.write(
		`Ship check could not run: the ship check crashed (${err && err.message ? err.message : String(err)}).\n` +
			"Codex has no permission prompt for this hook, so the ship is denied. To ship anyway, run the command in your own terminal.\n",
	);
	process.exit(2);
});

const { readPayload, deny } = require("./lib/codex-hook-runtime.cjs");
const { enterGuardRoot, resolveShipRoot } = require("./lib/project-root.cjs");
const { decidePreShip } = require("./lib/core/pre-ship.cjs");

const input = readPayload();
const toolInput = input && typeof input.tool_input === "object" && input.tool_input ? input.tool_input : {};
const command = typeof toolInput.command === "string" ? toolInput.command : "";
if (!command) process.exit(0);

const root = enterGuardRoot(input && typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd(), process.env, resolveShipRoot, command);
if (!root) deny("Ship check cannot locate the project root this command ships from.");

const result = decidePreShip({ root, command, env: process.env });
if (result.stdout.length) process.stderr.write(`${result.stdout.join("\n")}\n`);
if (result.exit === 2) {
	const lines = [...result.stderr, ...result.stdout.filter((l) => /FAIL|DID NOT FINISH|COULD NOT RUN|did not run/.test(l))];
	if (result.outcome === "could_not_run") {
		lines.push("Codex has no permission prompt for this hook, so the ship is denied. To ship anyway, run the command in your own terminal.");
	}
	deny(lines.join("\n"));
}
process.exit(0);
