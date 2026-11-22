#!/usr/bin/env node
// Grok PreToolUse ship check (Bash matcher; Grok maps the name to its own shell tool).
//
// A git commit, push or merge, or `gh pr create|merge`, runs the memory lint, lint on the
// changed files, the tests related to them and a project-wide type-check
// (lib/core/pre-ship.cjs, copied from .claude/hooks/lib). Any other command passes untouched.
//
// Contract: lib/grok-hook-runtime.cjs. A crash denies the ship with the reason. A hook Grok
// stops at its timeout does not block, which is why the checks stop at their own deadline first.
"use strict";

process.on("uncaughtException", (err) => {
	process.stderr.write(`Ship check could not run: ${err && err.message ? err.message : String(err)}\n`);
	process.exit(2);
});

const { commandOf, deny, readPayload, sessionRoot, toolInput } = require("./lib/grok-hook-runtime.cjs");
const { enterGuardRoot, resolveShipRoot } = require("./lib/project-root.cjs");
const { decidePreShip } = require("./lib/core/pre-ship.cjs");

const payload = readPayload();
const command = commandOf(toolInput(payload));
if (!command) process.exit(0);

const root = enterGuardRoot(sessionRoot(payload), process.env, resolveShipRoot, command);
if (!root) deny("Ship check cannot locate the project root this command ships from.");

const result = decidePreShip({ root, command, env: process.env });
if (result.stdout.length) process.stderr.write(`${result.stdout.join("\n")}\n`);
if (result.exit === 2) {
	const lines = [...result.stderr, ...result.stdout.filter((l) => /FAIL|DID NOT FINISH|COULD NOT RUN|did not run/.test(l))];
	if (result.outcome === "could_not_run") lines.push("This runtime has no permission prompt for the ship check, so the ship is denied. To ship anyway, run the command in your own terminal.");
	deny(lines.join("\n"));
}
process.exit(0);
