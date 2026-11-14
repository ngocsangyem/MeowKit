#!/usr/bin/env node
// Shared I/O + root-resolution primitives for every native Codex hook in this
// bundle. Pure plumbing only — no policy decisions live here (policy stays in
// the individual hook scripts). Kept dependency-free (Node core only) so hooks
// run with zero install step inside a user's project.
//
// Codex hook contract (learn.chatgpt.com/docs/hooks, verified 2026-07-26):
//   stdin  = JSON { hook_event_name, session_id, cwd, tool_name, tool_input, ... }
//   deny   = stdout JSON { hookSpecificOutput: { hookEventName, permissionDecision:
//            "deny", permissionDecisionReason } }, exit 0
//   allow  = exit 0 with no deny payload
"use strict";
const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync, realpathSync } = require("node:fs");
const { dirname, join } = require("node:path");

/** Resolve symlinks in a path, returning it unchanged when it cannot be resolved.
 *  `git rev-parse --show-toplevel` always reports a canonical path, so the session
 *  cwd must be canonicalized too or the two disagree on any symlinked prefix
 *  (macOS `/var` → `/private/var` being the everyday case) and every root-relative
 *  path comparison silently produces a `../..` escape. */
function realpathSafe(p) {
	try {
		return realpathSync(p);
	} catch {
		return p;
	}
}

/** Read + parse the hook's JSON payload from stdin. Returns null on empty,
 *  unreadable, or unparseable stdin — callers treat null as "cannot verify this
 *  payload" and fail open, since the `mewkit` CLI gate stays authoritative. */
function readPayload() {
	let raw;
	try {
		raw = readFileSync(0, "utf-8");
	} catch {
		return null;
	}
	if (!raw || !raw.trim()) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

/** Canonicalize a path that may not exist yet — an `*** Add File:` target names a
 *  file that is about to be created. Resolves symlinks in the longest existing
 *  ancestor and re-appends the not-yet-created remainder, so a to-be-created path
 *  still compares correctly against a canonical project root. */
function realpathSafePartial(p) {
	let dir = p;
	const tail = [];
	for (;;) {
		if (existsSync(dir)) return join(realpathSafe(dir), ...tail.reverse());
		const parent = dirname(dir);
		if (parent === dir) return p; // reached the filesystem root without finding anything
		tail.push(dir.slice(parent.length + 1));
		dir = parent;
	}
}

/** The directory Codex was invoked from, per the payload's documented `cwd`
 *  field, canonicalized. This is the SESSION cwd, which is NOT necessarily the
 *  project root — see projectRoot() below. */
function sessionCwd(payload) {
	const fromPayload = payload && typeof payload.cwd === "string" ? payload.cwd : "";
	return realpathSafe(fromPayload || process.cwd());
}

// Directories that mark a toolkit-managed project root, used when the git
// lookup cannot answer (non-git checkout, git absent from PATH).
const ROOT_MARKERS = [".codex", ".meowkit", "tasks"];

/** Walk up from `start` looking for a project-root marker directory. Returns
 *  null when none is found before the filesystem root. */
function walkUpForMarker(start) {
	let dir = start;
	for (;;) {
		for (const marker of ROOT_MARKERS) {
			if (existsSync(join(dir, marker))) return dir;
		}
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

/**
 * Resolve the project root for a hook invocation.
 *
 * Codex sets NO project-root environment variable — the documented hook env is
 * limited to PLUGIN_ROOT / PLUGIN_DATA (and their CLAUDE_PLUGIN_* compatibility
 * aliases), which describe a plugin bundle, not the user's repository. The docs
 * are explicit that "Codex may be started from a subdirectory" and recommend
 * resolving from the git root, so this mirrors that recommendation rather than
 * trusting the payload `cwd`. Trusting `cwd` would make Gate 1 look for
 * `<subdir>/tasks/plans`, find nothing, and deny every source edit.
 *
 * Order: git top level → nearest marker directory → the session cwd itself
 * (fail-safe: an unresolvable root leaves the caller's own default behavior,
 * which for the gate is "deny", intact).
 */
function projectRoot(cwd) {
	const start = realpathSafe(cwd || process.cwd());
	try {
		const res = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: start, encoding: "utf-8" });
		if (res.status === 0 && typeof res.stdout === "string" && res.stdout.trim()) {
			return realpathSafe(res.stdout.trim());
		}
	} catch {
		/* git missing or unusable — fall through to the marker walk */
	}
	return walkUpForMarker(start) ?? start;
}

/** Emit a PreToolUse deny decision and exit. Exit 0 + JSON is the documented
 *  deny form; exit 2 is the alternative, but this bundle uses the JSON form
 *  uniformly so the reason travels as structured output rather than stderr. */
function deny(reason, hookEventName = "PreToolUse") {
	process.stdout.write(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName,
				permissionDecision: "deny",
				permissionDecisionReason: reason,
			},
		}),
	);
	process.exit(0);
}

module.exports = {
	readPayload,
	sessionCwd,
	projectRoot,
	walkUpForMarker,
	realpathSafe,
	realpathSafePartial,
	deny,
	ROOT_MARKERS,
};
