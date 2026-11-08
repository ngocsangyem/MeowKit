#!/usr/bin/env node
// write-run-manifest.cjs — write the initial benchmark run manifest.
//
// Input (env, so a spec filename containing quotes stays data): RUN_ID, TIER,
// STARTED, MODEL, COST_CAP, TASKS_JSON, RESULT_FILE.

const fs = require("node:fs");

const env = process.env;
const manifest = {
	run_id: env.RUN_ID,
	tier: env.TIER,
	started: env.STARTED,
	ended: null,
	harness_version: "3.0.0",
	model: env.MODEL,
	cost_cap_usd: Number(env.COST_CAP),
	total_cost_usd: 0,
	total_duration_seconds: 0,
	tasks: JSON.parse(env.TASKS_JSON),
	summary: { passed: 0, warned: 0, failed: 0, average_score: 0 },
	status: "in_progress",
};

fs.writeFileSync(env.RESULT_FILE, JSON.stringify(manifest, null, 2));
console.log(`Manifest: ${env.RESULT_FILE}`);
