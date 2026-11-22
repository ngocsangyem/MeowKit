#!/usr/bin/env node
// The kit's two guards for a runtime whose hooks are code, not a hook file: the Pi extension
// and the OMP hook module each run this once per tool call and block on its answer.
//
//   node guard.cjs --file <path>   the file holds { "toolName": "bash", "input": { ... }, "cwd": "/project" }
//   node guard.cjs '<json>'         the same object as one argument, for a short call
//   stdout: { "block": false } or { "block": true, "reason": "..." }, exit 0
//
// The decisions are the shared ones Claude Code, Codex and Cursor run (lib/core/privacy.cjs and
// lib/core/pre-ship.cjs, copied from .claude/hooks/lib): no credential file is read or sent
// anywhere without the user's approval, and a git commit, push or merge, or `gh pr
// create|merge`, first passes the memory lint, lint on the changed files, the tests related to
// them and a type-check.
//
// A crash, unreadable input or a missing runtime config exits 2 with nothing on stdout. The
// caller treats anything but a parsed answer as a block.
"use strict";

process.on("uncaughtException", (err) => {
	process.stderr.write(`Guard could not run: ${err && err.message ? err.message : String(err)}\n`);
	process.exit(2);
});

const { readFileSync } = require("node:fs");
const { denyReason, loadRuntime, targetPaths } = require("./lib/hook-runtime.cjs");
const { decidePrivacy } = require("./lib/core/privacy.cjs");
const { enterGuardRoot, resolveShipRoot } = require("./lib/project-root.cjs");
const { decidePreShip } = require("./lib/core/pre-ship.cjs");

const RUNTIME = "agents";

function answer(block, reason) {
	process.stdout.write(JSON.stringify(block ? { block: true, reason } : { block: false }));
	process.exit(0);
}

if (loadRuntime(__dirname, { emitted: true }) !== RUNTIME) {
	answer(true, "Guard cannot run: .agents/meowkit/hooks/hook-runtime-config.json is missing or not for this tree. Reinstall with `mewkit init`.");
}

let call;
try {
	call = JSON.parse(process.argv[2] === "--file" ? readFileSync(process.argv[3], "utf8") : process.argv[2]);
} catch {
	call = null;
}
if (call === null || typeof call !== "object" || Array.isArray(call)) {
	answer(true, "Guard received an unreadable tool call. A guard that cannot read the call must not allow it.");
}

const input = call.input !== null && typeof call.input === "object" && !Array.isArray(call.input) ? call.input : {};
const command = typeof input.command === "string" ? input.command : "";

// Words in the command that look like paths (a `/`, a `.`, a leading `~`, or a bare private
// key name) go to the privacy decision with the paths the call names. A bare word such as
// `secrets` in `kubectl get secrets` is not a path and is left alone.
const commandPaths = command
	.split(/[\s'"`=(><|;&@:,]+/)
	.filter((word) => word && !/^-/.test(word) && (/[./~]/.test(word) || /^id_(?:rsa|ed25519|ecdsa|dsa)$/i.test(word)));

// A read tool may take a selector after the path (`.env:raw`, `notes.md:1-50`,
// `archive.zip:dir/.env`), so each part between colons is judged as a path as well as the whole.
const named = targetPaths(input);
const parts = named.flatMap((value) => (value.includes(":") ? value.split(":").filter(Boolean) : []));

const privacy = decidePrivacy({ paths: [...named, ...parts, ...commandPaths], command });
if (privacy.exit === 2) answer(true, denyReason(privacy, RUNTIME));

if (command) {
	const cwd = typeof call.cwd === "string" && call.cwd ? call.cwd : process.cwd();
	const root = enterGuardRoot(cwd, process.env, resolveShipRoot, command);
	if (!root) answer(true, "Ship check cannot locate the project root this command ships from.");
	const ship = decidePreShip({ root, command, env: process.env });
	if (ship.stdout.length) process.stderr.write(`${ship.stdout.join("\n")}\n`);
	if (ship.exit === 2) {
		const lines = [...ship.stderr, ...ship.stdout.filter((l) => /FAIL|DID NOT FINISH|COULD NOT RUN|did not run/.test(l))];
		if (ship.outcome === "could_not_run") lines.push("This runtime has no permission prompt for the ship check, so the ship is denied. To ship anyway, run the command in your own terminal.");
		answer(true, lines.join("\n"));
	}
}
answer(false);
