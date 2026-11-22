#!/usr/bin/env node
// `beforeShellExecution` ship check — its own hook entry with its own timeout, fail-closed.
//
// A git commit, push or merge, or `gh pr create|merge`, runs the memory lint, lint on the
// changed files, the tests related to them and a project-wide type-check
// (lib/core/pre-ship.cjs, copied from .claude/hooks/lib). Any other command passes untouched.
//
// A failed check answers `deny`. A check that could not run (a crash, a missing tool, the
// deadline) answers `ask`, which Cursor enforces on this event, so the person at the prompt
// decides. That prompt is the only override: the hooks kill switch does not stand this check
// down, and the output says so when it is set. `failClosed: true` in hooks.json makes a hook
// that crashes before answering, or that Cursor stops at its timeout, block as well.
//
// Cursor also loads the Claude Code hooks of a project that carries both kits, so the same
// command can reach the Claude Code ship check too; the shared run-once marker makes the second
// one report the first one's result.
"use strict";

process.on("uncaughtException", (err) => {
	const reason = `MeowKit ship check could not run: the ship check crashed (${err && err.message ? err.message : String(err)}). The ship is unverified.`;
	process.stdout.write(JSON.stringify({ permission: "ask", user_message: reason, agent_message: reason }));
	process.exit(0);
});

const { readStdinPayload, projectRoot, emit } = require("./lib/cursor-hook-runtime.cjs");
const { enterGuardRoot, resolveShipRoot } = require("./lib/project-root.cjs");
const { decidePreShip } = require("./lib/core/pre-ship.cjs");

const payload = readStdinPayload();
const command = payload && typeof payload.command === "string" ? payload.command : "";
if (!command) emit({ permission: "allow" });

const start = payload && typeof payload.cwd === "string" && payload.cwd ? payload.cwd : projectRoot();
const root = enterGuardRoot(start, process.env, resolveShipRoot, command);
const result = root
	? decidePreShip({ root, command, env: process.env })
	: { exit: 2, stdout: [], stderr: ["Ship check cannot locate the project root this command ships from."], outcome: "failed" };
if (result.stdout.length) process.stderr.write(`${result.stdout.join("\n")}\n`);
if (result.exit !== 2) emit({ permission: "allow" });

const lines = [...result.stderr, ...result.stdout.filter((l) => /FAIL|DID NOT FINISH|COULD NOT RUN|did not run/.test(l))];
const reason = lines.join("\n");
emit({
	permission: result.outcome === "could_not_run" ? "ask" : "deny",
	user_message: `MeowKit ship check: ${reason}`,
	agent_message: reason,
});
