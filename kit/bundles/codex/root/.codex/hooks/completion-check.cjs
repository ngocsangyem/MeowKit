#!/usr/bin/env node
// Codex opt-in completion check (SessionStart, PostToolUse Bash, Stop).
//
// Off unless `.meowkit/config.yaml` sets `hooks.pre-completion-check: true`. The rule is the
// shared one in lib/core/completion-check.cjs (copied from .claude/hooks/lib):
//   SessionStart        record the tree the session starts from
//   PostToolUse (Bash)  after a test, build, lint or type-check command that exited 0, record
//                       the tree. Codex runs PostToolUse after a failing command too, so a pass
//                       is recorded only when the result carries an exit code of 0.
//   Stop                files changed since then: `decision: "block"` with a reason, which Codex
//                       turns into a continuation prompt; at most twice, then a notice.
//
// Fail-open: any fault exits 0 with no decision. Codex needs JSON on stdout at exit 0 on Stop.
"use strict";

const path = require("node:path");
const { readPayload } = require("./lib/codex-hook-runtime.cjs");
const check = require("./lib/core/completion-check.cjs");

/** The exit code a Codex tool result carries, or null when it carries none. */
function exitCodeOf(response) {
	if (!response || typeof response !== "object") return null;
	for (const holder of [response, response.metadata, response.output]) {
		if (!holder || typeof holder !== "object") continue;
		for (const key of ["exit_code", "exitCode"]) if (Number.isInteger(holder[key])) return holder[key];
	}
	return null;
}

function run() {
	const input = readPayload() || {};
	const event = typeof input.hook_event_name === "string" ? input.hook_event_name : "";
	const root = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
	if (!check.enabledFor(root)) return event === "Stop" ? {} : null;
	const stateFile = path.join(root, ".meowkit", "state", check.STATE_FILE);
	const sessionId = typeof input.session_id === "string" ? input.session_id : "";

	if (event === "SessionStart") {
		check.recordBaseline({ root, stateFile, sessionId });
		return null;
	}
	if (event === "PostToolUse") {
		const command = input.tool_input && typeof input.tool_input.command === "string" ? input.tool_input.command : "";
		if (exitCodeOf(input.tool_response) === 0) check.recordPass({ root, stateFile, sessionId, command });
		return null;
	}
	if (event === "Stop") {
		const decision = check.decideStop({ root, stateFile, sessionId, stopHookActive: input.stop_hook_active === true });
		if (decision.action === "block") return { decision: "block", reason: decision.reason };
		if (decision.action === "notice") return { systemMessage: decision.message };
		return {};
	}
	return null;
}

let out = null;
try {
	out = run();
} catch (err) {
	process.stderr.write(`completion check skipped: ${err && err.message ? err.message : String(err)}\n`);
	out = {};
}
if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
process.exit(0);
