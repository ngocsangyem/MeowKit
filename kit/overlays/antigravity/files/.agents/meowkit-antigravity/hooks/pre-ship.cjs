#!/usr/bin/env node
// Antigravity PreToolUse ship check, registered in .agents/hooks.json on the `run_command` tool.
//
// A git commit, push or merge, or `gh pr create|merge`, runs the memory lint, lint on the
// changed files, the tests related to them and a project-wide type-check
// (lib/core/pre-ship.cjs, copied from .claude/hooks/lib). Any other command is allowed.
//
// Contract: lib/antigravity-hook-runtime.cjs. Built from Antigravity's documentation and not yet
// seen to deny in a live run. A failed check denies. A check that reached no verdict (a missing
// tool, the deadline) answers `force_ask`, which the page documents as a prompt that ignores
// cached approvals, so the person decides as on Claude Code and Cursor. A crash, unreadable
// stdin or an unknown project root denies. The registration's timeout sits above the checks'
// own deadline, because what the host does with a hook it stops is not documented.
"use strict";

// Written before anything is required, so a missing library still answers with a deny.
function denyOnError(err) {
	const reason = `Ship check could not run: ${err && err.message ? err.message : String(err)}. To ship anyway, run the command in your own terminal.`;
	process.stdout.write(JSON.stringify({ decision: "deny", reason }));
	process.exit(0);
}
process.on("uncaughtException", denyOnError);

const { allow, answer, commandOf, deny, readPayload, sessionRoot, toolInput } = require("./lib/antigravity-hook-runtime.cjs");
const { enterGuardRoot, resolveShipRoot } = require("./lib/project-root.cjs");
const { decidePreShip } = require("./lib/core/pre-ship.cjs");

const payload = readPayload();
if (!payload) deny("Ship check received unreadable hook input, so it cannot tell whether this command ships. To ship anyway, run the command in your own terminal.");

const command = commandOf(toolInput(payload));
if (!command) allow();

const root = enterGuardRoot(sessionRoot(payload), process.env, resolveShipRoot, command);
if (!root) deny("Ship check cannot locate the project root this command ships from. To ship anyway, run the command in your own terminal.");

const result = decidePreShip({ root, command, env: process.env });
if (result.stdout.length) process.stderr.write(`${result.stdout.join("\n")}\n`);
if (result.exit === 2) {
	const lines = [...result.stderr, ...result.stdout.filter((l) => /FAIL|DID NOT FINISH|COULD NOT RUN|did not run/.test(l))];
	if (result.outcome === "could_not_run") {
		lines.push("The ship check reached no verdict. Approve only to ship without it; otherwise deny and run the command in your own terminal once the check can run.");
		answer("force_ask", lines.join("\n"));
	}
	deny(lines.join("\n"));
}
allow();
