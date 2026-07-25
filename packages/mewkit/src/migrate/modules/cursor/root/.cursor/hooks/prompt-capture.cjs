#!/usr/bin/env node
// `beforeSubmitPrompt` adapter: mirrors codex's capture.cjs `##prefix` routing
// but speaks Cursor's native contract (in: `prompt, attachments`; out:
// `continue, user_message` — no prompt-rewriting capability, hence
// "block-only": this hook can only allow-through or block the WHOLE prompt,
// never inject/modify content). NOT security-critical (noncritical, fail
// open — failClosed: false in hooks.json): a capture failure never blocks
// prompt submission. Secret scrubbing and the injection scan both happen
// inside `mewkit memory capture` (the single write authority) — never
// duplicated here.
"use strict";
const { spawnSync } = require("node:child_process");
const { readStdinPayload, projectRoot, emit } = require("./lib/cursor-hook-runtime.cjs");

const payload = readStdinPayload();
const prompt = payload && typeof payload.prompt === "string" ? payload.prompt : "";
const root = projectRoot();

// Fast no-op unless the prompt opens with a capture prefix — no CLI spawn, no
// latency, for the overwhelming majority of prompts.
if (!/^\s*##(pattern|decision|note):/i.test(prompt)) {
	emit({ continue: true });
}

const res = spawnSync("mewkit", ["memory", "capture"], { input: prompt, cwd: root, encoding: "utf-8" });
if (res.status !== 0 && res.stderr) {
	process.stderr.write(`memory capture: ${res.stderr.trim()}\n`);
}
// Capture is a side effect; it never blocks prompt submission.
emit({ continue: true });
