#!/usr/bin/env node
// `stop` adapter. Bounded, optional `followup_message` only: `stop` has no permission or
// continue field, so this hook never blocks; a follow-up message is Cursor's way to start
// another turn, and `loop_limit` in hooks.json stays the structural runaway guard.
//
// Two follow-ups, both short and static (never derived from payload content):
//   - the opt-in completion check (shared rule, lib/core/completion-check.cjs): files changed
//     since the session's last passing verification command, at most twice per session;
//   - a turn that ended in an error, while loop_count is below 3.
"use strict";
const path = require("node:path");
const { readStdinPayload, projectRoot, emit } = require("./lib/cursor-hook-runtime.cjs");
const { appendTelemetry } = require("./lib/telemetry-writer.cjs");
const check = require("./lib/core/completion-check.cjs");

const payload = readStdinPayload();
const root = projectRoot();
appendTelemetry(root, "stop-events.jsonl", payload ?? {});

const status = payload && typeof payload.status === "string" ? payload.status : null;
const loopCount = payload && typeof payload.loop_count === "number" ? payload.loop_count : 0;

if (status !== "aborted") {
	try {
		if (check.enabledFor(root)) {
			const sessionId = payload && typeof payload.conversation_id === "string" ? payload.conversation_id : "";
			const decision = check.decideStop({ root, stateFile: path.join(root, ".meowkit", "state", check.STATE_FILE), sessionId, stopHookActive: loopCount > 0 });
			if (decision.action === "block") emit({ followup_message: decision.reason });
			if (decision.action === "notice") process.stderr.write(`${decision.message}\n`);
		}
	} catch (err) {
		process.stderr.write(`completion check skipped: ${err && err.message ? err.message : String(err)}\n`);
	}
}

if (status === "error" && loopCount < 3) {
	emit({ followup_message: "The previous turn ended in an error. Consider a short diagnostic pass before continuing." });
}

emit({});
