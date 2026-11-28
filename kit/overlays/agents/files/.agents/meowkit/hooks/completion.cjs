#!/usr/bin/env node
// The opt-in completion check and the plan-state sync for a runtime whose hooks are code: the
// Pi extension and the OMP hook module run this on three events and act on its answer.
//
//   node completion.cjs --file <path>   the file holds one call:
//     { "event": "session_start", "cwd": "/project", "sessionId": "s1" }
//     { "event": "tool_result", "cwd": ..., "sessionId": ..., "command": "cargo test", "passed": true }
//     { "event": "agent_end", "cwd": ..., "sessionId": ... }
//   stdout: { "action": "allow" | "block" | "notice", "reason"?, "message"?, "planLine"? }, exit 0
//
// The rule is the one Claude Code, Codex and Cursor run (lib/core/completion-check.cjs, copied
// from .claude/hooks/lib), off unless `.meowkit/config.yaml` sets
// `hooks.pre-completion-check: true`:
//   session_start  record the tree the session starts from
//   tool_result    a test, build, lint or type-check command the caller saw succeed: record the tree
//   agent_end      files changed since then: `block` with a reason the caller sends as a
//                  follow-up message; at most twice per session, then a `notice`
// Every agent_end also brings changed plans' derived state up to date with their checkboxes
// (lib/core/plan-state-sync.cjs), always on; its one line comes back as `planLine`.
//
// Fail-open: unreadable input or any fault answers `allow`. Nothing here may stop a session.
"use strict";

const { readFileSync } = require("node:fs");
const path = require("node:path");

function answer(value) {
	process.stdout.write(JSON.stringify(value));
	process.exit(0);
}

process.on("uncaughtException", (err) => {
	process.stderr.write(`completion check skipped: ${err && err.message ? err.message : String(err)}\n`);
	answer({ action: "allow" });
});

const check = require("./lib/core/completion-check.cjs");
const planState = require("./lib/core/plan-state-sync.cjs");
const { resolveProjectRoot } = require("./lib/project-root.cjs");

let call = null;
try {
	call = JSON.parse(process.argv[2] === "--file" ? readFileSync(process.argv[3], "utf8") : process.argv[2]);
} catch {
	call = null;
}
if (call === null || typeof call !== "object" || Array.isArray(call)) answer({ action: "allow" });

const cwd = typeof call.cwd === "string" && call.cwd ? call.cwd : process.cwd();
// The runtime names the session's directory, so its git top level is the root. Root variables
// are not read: one inherited from a parent session (CLAUDE_PROJECT_DIR when a runtime was
// started from a Claude Code shell) could name another project.
const root = resolveProjectRoot({}, cwd);
const sessionId = typeof call.sessionId === "string" ? call.sessionId : "";
const stateFile = path.join(root, ".meowkit", "state", check.STATE_FILE);
const enabled = check.enabledFor(root);

if (call.event === "session_start") {
	if (enabled) check.recordBaseline({ root, stateFile, sessionId });
	answer({ action: "allow" });
}

if (call.event === "tool_result") {
	const command = typeof call.command === "string" ? call.command : "";
	// Only a result the runtime reported as a success counts; anything else records nothing.
	if (enabled && call.passed === true && command) check.recordPass({ root, stateFile, sessionId, command });
	answer({ action: "allow" });
}

if (call.event === "agent_end") {
	let planLine = "";
	try {
		planLine = planState.summaryLine(planState.syncChangedPlans(root, { write: true })) || "";
	} catch (err) {
		process.stderr.write(`plan state sync skipped: ${err && err.message ? err.message : String(err)}\n`);
	}
	const decision = enabled ? check.decideStop({ root, stateFile, sessionId }) : { action: "allow" };
	answer(planLine ? { ...decision, planLine } : decision);
}

answer({ action: "allow" });
