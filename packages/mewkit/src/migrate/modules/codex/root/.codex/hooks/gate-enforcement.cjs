#!/usr/bin/env node
// Codex PreToolUse Gate 1 guard (file-edit matcher: apply_patch / Edit / Write).
//
// Runs the same Gate 1 decision as Claude Code (lib/core/plan-gate.cjs, copied from
// .claude/hooks/lib): a source edit needs an approved plan whose approval receipt still
// matches its body, and a signed sprint contract. Every file an `apply_patch` touches is
// judged, so a patch that edits docs and source together is gated on the source file.
//
// Codex hook contract (learn.chatgpt.com/docs/hooks, verified 2026-07-26):
//   stdin = JSON { hook_event_name, tool_name, tool_input: { command }, cwd, ... }.
//   deny  = stdout JSON permissionDecision:"deny", exit 0; exit 2 + stderr also blocks.
//
// Fails closed: unreadable stdin, a missing or foreign runtime config, an unresolvable project
// root or a crash all deny. A crash uses exit 2 + stderr because it may happen before the
// JSON helper loads.
//
// The payload `cwd` is the SESSION directory, which may be below the repository root. Plan
// lookup and path classification are root-relative, so relative targets are resolved against
// `cwd` and then re-expressed against the root.
"use strict";

process.on("uncaughtException", (err) => {
	process.stderr.write(`Gate 1 could not run: ${err && err.message ? err.message : String(err)}\n`);
	process.exit(2);
});

const { isAbsolute, relative, resolve } = require("node:path");
const { readPayload, sessionCwd, realpathSafePartial, deny } = require("./lib/codex-hook-runtime.cjs");
const { denyReason, loadRuntime, nonSourceTrees, targetPaths } = require("./lib/hook-runtime.cjs");
const { enterGuardRoot } = require("./lib/project-root.cjs");
const { decidePlanGate } = require("./lib/core/plan-gate.cjs");

if (loadRuntime(__dirname, { emitted: true }) !== "codex") {
	deny("Gate 1 cannot run: .codex/hooks/hook-runtime-config.json is missing or not for codex. Reinstall with `mewkit init --target codex`.");
}

const input = readPayload();
if (!input) deny("Gate 1 received unreadable hook input. A write guard that cannot read what is being written must not allow it.");

const cwd = sessionCwd(input);
const root = enterGuardRoot(cwd);
if (!root) deny("Gate 1 cannot locate the project root it guards (no git repository or .meowkit/ above the session directory).");

/** Root-relative, forward-slash form of a target named relative to the session cwd. */
function toRootRelative(p) {
	const absolute = isAbsolute(p) ? realpathSafePartial(p) : resolve(cwd, p);
	return relative(root, absolute).replace(/\\/g, "/");
}

// An edit whose targets cannot be read is not an edit to nothing: the payload shape is not the
// one this guard knows, so it blocks rather than letting an unknown write through.
const named = targetPaths(input.tool_input);
if (named.length === 0) deny("Gate 1 cannot tell which files this edit writes (no recognised target in tool_input).");
const paths = named.map(toRootRelative);
const result = decidePlanGate({ root, paths, env: process.env, extraNonSource: nonSourceTrees("codex") });
if (result.exit === 2) deny(denyReason(result, "codex"));
if (result.stderr.length) process.stderr.write(`${result.stderr.join("\n")}\n`);
process.exit(0);
