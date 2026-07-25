#!/usr/bin/env node
// Shared adapter for `subagentStart` + `subagentStop`. Delegation lifecycle is
// NOT security-critical (failClosed: false in hooks.json for both) — malformed
// input is handled by allowing (start) or simply skipping the followup (stop),
// never by blocking. `subagentStop` persists a bounded, PII-scrubbed status
// record to `.meowkit/telemetry/` and may emit a short `followup_message` when
// the subagent ended in error/aborted status.
"use strict";
const { readStdinPayload, projectRoot, emit } = require("./lib/cursor-hook-runtime.cjs");
const { appendTelemetry } = require("./lib/telemetry-writer.cjs");

const payload = readStdinPayload();
const root = projectRoot();

if (!payload || typeof payload.hook_event_name !== "string") emit({});

if (payload.hook_event_name === "subagentStart") {
	appendTelemetry(root, "subagent-lifecycle.jsonl", payload);
	const wellFormed = typeof payload.subagent_id === "string" && typeof payload.subagent_type === "string";
	emit(
		wellFormed
			? { permission: "allow" }
			: { permission: "allow", user_message: "subagentStart payload missing expected fields; allowing (noncritical)." },
	);
}

if (payload.hook_event_name === "subagentStop") {
	appendTelemetry(root, "subagent-lifecycle.jsonl", payload);
	const status = typeof payload.status === "string" ? payload.status : null;
	if (status === "error" || status === "aborted") {
		emit({ followup_message: `Subagent ${status}. Review .meowkit/telemetry/subagent-lifecycle.jsonl before retrying.` });
	}
	emit({});
}

emit({});
