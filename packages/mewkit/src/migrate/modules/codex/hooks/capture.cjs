#!/usr/bin/env node
// Codex UserPromptSubmit capture hook (thin wrapper — reused across providers).
//
// Codex delivers the SAME JSON-on-stdin contract as Claude Code: an object with
// `prompt`, `cwd`, `hook_event_name`, etc. This hook reads that JSON, and ONLY when
// the prompt starts with a `##pattern`/`##decision`/`##note` prefix does it route
// the prompt to `mewkit memory capture`, which writes via the .meowkit/ write
// contract. A non-prefixed prompt is a fast no-op (exit 0, no state reads, no
// latency). Output is status-only: the prompt content is never echoed to stdout
// (which Codex would surface to the model), so no captured content or secret leaks.
"use strict";
const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");

let input;
try {
	input = JSON.parse(readFileSync(0, "utf-8"));
} catch {
	process.exit(0); // no/invalid stdin → nothing to capture
}

const prompt = typeof input.prompt === "string" ? input.prompt : "";
const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();

// Fast no-op unless the prompt opens with a capture prefix (matches memory-capture.ts).
if (!/^\s*##(pattern|decision|note):/i.test(prompt)) process.exit(0);

// Pipe the prompt to the CLI capture path (single write authority). Run in the
// project's cwd so the CLI resolves the correct .meowkit/ root.
const res = spawnSync("mewkit", ["memory", "capture"], { input: prompt, cwd, encoding: "utf-8" });
if (res.status !== 0 && res.stderr) process.stderr.write(`memory capture: ${res.stderr.trim()}\n`);
process.exit(0); // never block the turn on a capture failure
