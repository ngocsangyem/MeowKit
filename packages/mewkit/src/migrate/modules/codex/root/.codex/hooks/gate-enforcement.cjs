#!/usr/bin/env node
// Codex PreToolUse gate guard (file-edit matcher: apply_patch / Edit / Write).
//
// Ports the toolkit's Gate 1 (gate-rules.md) to the native Codex hook contract: a source-code
// edit is DENIED unless an approved plan exists under tasks/plans/. Non-source files (plan,
// review, contract, docs, .claude/.codex/.agents/.meowkit trees, and test files) are always
// allowed; backup/legacy paths are rejected. This is the faithful PRESENCE gate. The
// approval-RECEIPT layer (a plan file must also carry a fresh receipt) is NOT ported yet —
// tracked as a follow-on; presence is the foundational condition.
//
// Codex hook contract (learn.chatgpt.com/docs/hooks, verified 2026-07-26):
//   stdin = JSON { hook_event_name, tool_name, tool_input: { command }, cwd, ... }.
//   For apply_patch/Edit/Write, tool_input.command carries the patch / edit spec; target
//   paths are read from apply_patch `*** {Add,Update,Delete,Move} File:` markers (falling
//   back to explicit path fields). deny = stdout JSON permissionDecision:"deny", exit 0.
//
// The payload `cwd` is the SESSION directory, which Codex documents may be a subdirectory
// of the repository. Plan lookup and path classification are both project-root-relative,
// so the root is resolved separately (see lib/codex-hook-runtime.cjs) — using `cwd` for
// either would deny every source edit whenever Codex is started below the root.
"use strict";
const { existsSync, readdirSync } = require("node:fs");
const { join, isAbsolute, relative, resolve } = require("node:path");
const { readPayload, sessionCwd, projectRoot, realpathSafePartial, deny } = require("./lib/codex-hook-runtime.cjs");

const input = readPayload();
if (!input) process.exit(0); // fail-open on parse; the CLI gate is authoritative

const cwd = sessionCwd(input);
const root = projectRoot(cwd);
const toolInput = input && typeof input.tool_input === "object" && input.tool_input ? input.tool_input : {};
const command = typeof toolInput.command === "string" ? toolInput.command : "";

/** Collect the file paths an edit targets: apply_patch File markers + explicit path fields. */
function targetPaths() {
	const paths = new Set();
	const markerRe = /^\*\*\*\s+(?:Add|Update|Delete|Move) File:\s+(.+?)\s*$/gim;
	let m;
	while ((m = markerRe.exec(command)) !== null) paths.add(m[1].trim());
	for (const key of ["path", "file_path", "filePath"]) {
		if (typeof toolInput[key] === "string" && toolInput[key]) paths.add(toolInput[key]);
	}
	return [...paths];
}

/** Normalize to a project-root-relative, forward-slash path. A relative target is
 *  resolved against the session cwd first (that is what it is relative to), then
 *  re-expressed against the root the ALLOWED patterns are written in terms of. */
function normalize(p) {
	const absolute = isAbsolute(p) ? realpathSafePartial(p) : resolve(cwd, p.replace(/^\.\//, ""));
	return relative(root, absolute).replace(/\\/g, "/");
}

const ALLOWED = [
	/^(?:.*\/)?tasks\/(?:plans|reviews|contracts)\//,
	/^(?:.*\/)?docs\//,
	/^(?:.*\/)?\.(?:claude|codex|agents|meowkit)\//,
	/\.(?:test|spec)\.[\w]+$/,
	/(?:^|\/)(?:__tests__|tests?)\//,
];
const BACKUP = /(?:^|\/)[^/]*\.(?:bak|tmp|backup)\/|(?:^|\/)[^/]*_(?:legacy|old)\//;

/** True when a plan file is present under tasks/plans/ (nested or flat layout). */
function planExists() {
	const plansDir = join(root, "tasks", "plans");
	if (!existsSync(plansDir)) return false;
	let entries;
	try {
		entries = readdirSync(plansDir, { withFileTypes: true });
	} catch {
		return false;
	}
	for (const e of entries) {
		if (e.isDirectory() && existsSync(join(plansDir, e.name, "plan.md"))) return true;
		if (e.isFile() && e.name.endsWith(".md")) return true;
	}
	return false;
}

const targets = targetPaths().map(normalize).filter(Boolean);
if (targets.length === 0) process.exit(0); // no determinable target → allow

for (const t of targets) {
	if (BACKUP.test(t)) {
		deny(`Edit targets a backup/legacy path (${t}). Move it to a clean location before editing.`);
	}
}

// Only source edits (a target that is NOT in the allowed set) require Gate 1.
const needsGate = targets.some((t) => !ALLOWED.some((re) => re.test(t)));
if (needsGate && !planExists()) {
	deny(
		"No approved plan found in tasks/plans/. Gate 1 requires an approved plan before source-code edits. " +
			"Create one first (mk:plan-creator, or mk:fix for simple fixes).",
	);
}

process.exit(0);
