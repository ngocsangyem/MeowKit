#!/usr/bin/env node
// write-audit-artifact.cjs — write the git tracked-state audit artifact and echo it
// compactly on stdout.
//
// Input (env): RUN_ID, TS, REPO, OUT_FILE, FILE_COUNT, DIR_COUNT, PATH_SHA,
// INDEX_SHA, WT_CLEAN, and for the comparison mode CMP_REMOTE, LOCAL_ONLY,
// REMOTE_ONLY, DIFF_CLEAN.
//
// With `--trace` it prints only the subset the trace writer records, and writes
// nothing.

const fs = require("node:fs");

const env = process.env;
const asBool = (s) => s === "true";

if (process.argv.includes("--trace")) {
	process.stdout.write(
		JSON.stringify({
			run_id: env.RUN_ID,
			repo: env.REPO,
			tracked_file_count: Number(env.FILE_COUNT),
			artifact: env.OUT_FILE,
		}),
	);
	process.exit(0);
}

const comparison = env.CMP_REMOTE
	? {
			remote: env.CMP_REMOTE,
			local_only_count: Number(env.LOCAL_ONLY),
			remote_only_count: Number(env.REMOTE_ONLY),
			recursive_diff_clean: asBool(env.DIFF_CLEAN),
		}
	: null;

const artifact = {
	type: "audit",
	run_id: env.RUN_ID,
	ts: env.TS,
	repo: env.REPO,
	tracked_file_count: Number(env.FILE_COUNT),
	directory_count_excl_git: Number(env.DIR_COUNT),
	tracked_path_sha256: env.PATH_SHA,
	tracked_index_sha256: env.INDEX_SHA,
	comparison,
	working_tree_clean: asBool(env.WT_CLEAN),
};

fs.writeFileSync(env.OUT_FILE, JSON.stringify(artifact, null, 2));
console.log(JSON.stringify(artifact));
