#!/usr/bin/env node
// Codex PreToolUse ship check (Bash matcher).
//
// A git commit, push or merge, or `gh pr create|merge`, runs the memory lint, lint on the
// changed files, the tests related to them and a project-wide type-check
// (lib/core/pre-ship.cjs, copied from .claude/hooks/lib). Any other command passes untouched.
//
// Codex hook contract: deny = stdout JSON { hookSpecificOutput: { permissionDecision: "deny" } },
// exit 0. `ask`, `approve` and `continue: false` fail the hook and let the call through on
// Codex, so deny is the only blocking form used here.
//
// A crash denies the ship with the reason, as the Claude Code ship check does; a host timeout
// does not block, which is why the checks stop at their own deadline first.
"use strict";

process.on("uncaughtException", (err) => {
	process.stderr.write(`Ship check could not run: ${err && err.message ? err.message : String(err)}\n`);
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
if (result.exit === 2) deny([...result.stderr, ...result.stdout.filter((l) => /FAIL|DID NOT FINISH|did not run/.test(l))].join("\n"));
process.exit(0);
