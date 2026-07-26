#!/usr/bin/env node
// Shared OBSERVE adapter for every fail-open telemetry event: `postToolUse`,
// `postToolUseFailure`, `afterFileEdit`, `afterShellExecution`,
// `afterMCPExecution`, `preCompact`, and `sessionEnd`. One script, seven
// hooks.json entries — each entry's own `hook_event_name` in the payload tells
// this script which JSONL file to append to. `sessionEnd` is fire-and-forget in
// the documented contract (no output field is read), so the session record it
// leaves behind is telemetry, not a gate. `preCompact` is best-effort ONLY here;
// memory commits never depend on it (they go through the transactional
// `mewkit memory capture` CLI path instead). None of these events ever
// block: malformed input is a silent no-op, never a deny — this file carries
// NO security-critical logic (failClosed: false for every entry in hooks.json).
"use strict";
const { readStdinPayload, projectRoot, emit } = require("./lib/cursor-hook-runtime.cjs");
const { appendTelemetry } = require("./lib/telemetry-writer.cjs");

const payload = readStdinPayload();
if (!payload || typeof payload.hook_event_name !== "string") emit({});

const root = projectRoot();
appendTelemetry(root, "observe-events.jsonl", payload);
emit({});
