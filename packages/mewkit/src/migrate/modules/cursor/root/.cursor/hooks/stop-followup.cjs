#!/usr/bin/env node
// `stop` adapter: Continue-workflow hook. Bounded, optional `followup_message`
// only — this hook NEVER blocks (there is no permission/continue field on
// `stop`'s documented output, only `followup_message`) and derives a followup
// only for an error status, keeping `loop_limit` in hooks.json — not this
// script — as the structural runaway guard.
"use strict";
const { readStdinPayload, projectRoot, emit } = require("./lib/cursor-hook-runtime.cjs");
const { appendTelemetry } = require("./lib/telemetry-writer.cjs");

const payload = readStdinPayload();
const root = projectRoot();
appendTelemetry(root, "stop-events.jsonl", payload ?? {});

const status = payload && typeof payload.status === "string" ? payload.status : null;
const loopCount = payload && typeof payload.loop_count === "number" ? payload.loop_count : 0;

// Bounded: at most one short, static follow-up message; never derived from
// untrusted upstream content (the payload's own fields are the only input, and
// none of them are echoed verbatim into the message).
if (status === "error" && loopCount < 3) {
	emit({ followup_message: "The previous turn ended in an error. Consider a short diagnostic pass before continuing." });
}

emit({});
