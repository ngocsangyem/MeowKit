#!/usr/bin/env node
// Codex Stop hook: plan-state sync only.
//
// Every Stop brings changed plans' derived state up to date with their checkboxes
// (lib/core/plan-state-sync.cjs). It never blocks, and adds one `systemMessage` line only when
// it changed something or a plan is ready to archive.
//
// The opt-in completion check (`hooks.pre-completion-check`) does not run on Codex. Its rule
// needs to know that a test, build, lint or type-check command passed, and Codex gives a hook
// no way to tell: from 0.120 through 0.142 and later, PostToolUse for the shell tool carries
// `tool_response` as the command's output text only, with no exit code. Blocking a Stop on
// evidence it can never see would continue every turn that changed files, whatever was run.
//
// Fail-open: a fault exits 0 with an empty object. Codex needs JSON on stdout at exit 0 on Stop.
"use strict";

const { readPayload } = require("./lib/codex-hook-runtime.cjs");
const planState = require("./lib/core/plan-state-sync.cjs");

/** The plan-state line for a Stop, or "". */
function planStateLine(input) {
	try {
		if (input.hook_event_name !== "Stop") return "";
		const root = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
		return planState.summaryLine(planState.syncChangedPlans(root, { write: true }));
	} catch (err) {
		process.stderr.write(`plan state sync skipped: ${err && err.message ? err.message : String(err)}\n`);
		return "";
	}
}

const input = readPayload() || {};
if (input.hook_event_name === "Stop") {
	const line = planStateLine(input);
	process.stdout.write(`${JSON.stringify(line ? { systemMessage: line } : {})}\n`);
}
process.exit(0);
