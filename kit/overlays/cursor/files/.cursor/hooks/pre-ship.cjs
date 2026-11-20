#!/usr/bin/env node
// `beforeShellExecution` ship check — its own hook entry with its own timeout, not fail-closed.
//
// A git commit, push or merge, or `gh pr create|merge`, runs the memory lint, lint on the
// changed files, the tests related to them and a project-wide type-check
// (lib/core/pre-ship.cjs, copied from .claude/hooks/lib). Any other command passes untouched.
//
// Cursor also loads the Claude Code hooks of a project that carries both kits, so the same
// command can reach the Claude Code ship check too; the shared run-once marker makes the second
// one report the first one's result.
"use strict";

process.on("uncaughtException", (err) => {
	process.stdout.write(JSON.stringify({ permission: "deny", user_message: `MeowKit ship check could not run: ${err && err.message ? err.message : String(err)}` }));
	process.exit(0);
});

const { readStdinPayload, projectRoot, isKillSwitchActive, emit } = require("./lib/cursor-hook-runtime.cjs");
const { decideWithKillSwitch } = require("./lib/security-gate-decision.cjs");
const { enterGuardRoot, resolveShipRoot } = require("./lib/project-root.cjs");
const { decidePreShip } = require("./lib/core/pre-ship.cjs");

const payload = readStdinPayload();
const command = payload && typeof payload.command === "string" ? payload.command : "";
if (!command) emit({ permission: "allow" });

const start = payload && typeof payload.cwd === "string" && payload.cwd ? payload.cwd : projectRoot();
const root = enterGuardRoot(start, process.env, resolveShipRoot, command);
const result = root
	? decidePreShip({ root, command, env: process.env })
	: { exit: 2, stdout: [], stderr: ["Ship check cannot locate the project root this command ships from."] };
if (result.stdout.length) process.stderr.write(`${result.stdout.join("\n")}\n`);

const reason = [...result.stderr, ...result.stdout.filter((l) => /FAIL|DID NOT FINISH|did not run/.test(l))].join("\n");
emit(
	decideWithKillSwitch({
		killSwitchActive: isKillSwitchActive(),
		blocked: result.exit === 2,
		reason,
		blockedOutput: { permission: "deny", user_message: `MeowKit ship check: ${reason}`, agent_message: reason },
		allowedOutput: { permission: "allow" },
	}),
);
