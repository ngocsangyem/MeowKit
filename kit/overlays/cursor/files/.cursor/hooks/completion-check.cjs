#!/usr/bin/env node
// Cursor opt-in completion check: evidence side (sessionStart, postToolUse).
//
// Off unless `.meowkit/config.yaml` sets `hooks.pre-completion-check: true`. The rule is the
// shared one in lib/core/completion-check.cjs (copied from .claude/hooks/lib):
//   sessionStart          record the tree the session starts from
//   postToolUse (Shell)   after a test, build, lint or type-check command, record the tree.
//                         Cursor runs postToolUse only for a tool that succeeded (failures go
//                         to postToolUseFailure), so reaching here means the command passed.
// The stop side lives in stop-followup.cjs. Observe-only: never blocks, always exits 0.
"use strict";

const path = require("node:path");
const { readStdinPayload, projectRoot, emit } = require("./lib/cursor-hook-runtime.cjs");
const check = require("./lib/core/completion-check.cjs");

try {
	const payload = readStdinPayload() || {};
	const root = projectRoot();
	if (check.enabledFor(root)) {
		const stateFile = path.join(root, ".meowkit", "state", check.STATE_FILE);
		const sessionId = typeof payload.conversation_id === "string" ? payload.conversation_id : typeof payload.session_id === "string" ? payload.session_id : "";
		const event = typeof payload.hook_event_name === "string" ? payload.hook_event_name : "";
		if (event === "sessionStart") check.recordBaseline({ root, stateFile, sessionId });
		else if (payload.tool_name === "Shell") {
			const command = payload.tool_input && typeof payload.tool_input.command === "string" ? payload.tool_input.command : "";
			check.recordPass({ root, stateFile, sessionId, command });
		}
	}
} catch (err) {
	process.stderr.write(`completion check skipped: ${err && err.message ? err.message : String(err)}\n`);
}
emit({});
