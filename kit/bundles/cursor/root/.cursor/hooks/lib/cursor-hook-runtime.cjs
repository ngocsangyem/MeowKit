#!/usr/bin/env node
// Shared I/O primitives for every native Cursor hook adapter in this bundle. Pure
// plumbing only — no policy decisions live here (policy lives in the per-event
// `*-policy.cjs` modules next to this file). Kept dependency-free (Node core only)
// so hooks run with zero install step inside a user's project.
"use strict";
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

/** Read + parse the hook's JSON payload from stdin. Returns null on empty,
 *  unreadable, or unparseable stdin — callers treat null as "cannot verify this
 *  schema", never as an empty-but-valid object (fail-closed callers deny on null;
 *  fail-open callers no-op on null). */
function readStdinPayload() {
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

/**
 * Resolve the project root Cursor is operating in. Cursor passes
 * `CURSOR_PROJECT_DIR` to every hook process (verified: cursor.com/docs/agent/hooks
 * env-vars list) — this bundle speaks ONLY the native Cursor contract and never
 * reads `CLAUDE_PROJECT_DIR`, even though Cursor also sets that alias for
 * cross-tool compatibility. Falls back to `process.cwd()` when the env var is
 * absent (manual/test invocation), never to a Claude-specific variable.
 */
function projectRoot() {
	const fromEnv = process.env.CURSOR_PROJECT_DIR;
	return typeof fromEnv === "string" && fromEnv ? fromEnv : process.cwd();
}

const KILL_SWITCH_ENV = "MEWKIT_CURSOR_HOOKS_KILL_SWITCH";
const KILL_SWITCH_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

/** Flag-file path for the kill switch, under `.meowkit/state` — never `.cursor/`,
 *  since `.meowkit/` is the one MeowKit-owned state root and this flag is runtime
 *  state, not a shipped bundle asset. `doctor-cursor.ts` prints a hint at this
 *  same path (kept in sync manually — see that file's header comment). */
function killSwitchFlagPath(root) {
	return join(root, ".meowkit", "state", "cursor-hooks-kill-switch");
}

/**
 * True when the security-gate kill switch is active: either the sentinel env var
 * is truthy, or the flag file exists under `.meowkit/state`. An active kill
 * switch downgrades every security-critical gate's deny/ask decision to allow
 * (see `security-gate-decision.cjs`) — the documented schema-drift-brick escape
 * hatch. Unknown-but-critical schema STILL denies by default while the switch is
 * off; this function does not change deny logic itself, only whether the caller
 * is permitted to downgrade it.
 */
function isKillSwitchActive(root) {
	const envValue = (process.env[KILL_SWITCH_ENV] || "").trim().toLowerCase();
	if (KILL_SWITCH_TRUE_VALUES.has(envValue)) return true;
	try {
		return existsSync(killSwitchFlagPath(root));
	} catch {
		return false;
	}
}

/** Write a loud, unmissable warning to stderr — used whenever the kill switch
 *  downgrades a deny/ask decision to allow, so a human sees the gate is disabled
 *  even though stdout only carries the (now-allow) JSON decision. */
function warnLoud(message) {
	process.stderr.write(`\n!!! MEOWKIT CURSOR HOOK KILL SWITCH ACTIVE !!!\n${message}\n\n`);
}

/** Emit the hook's JSON decision on stdout and exit 0. Every command hook in this
 *  bundle uses exit 0 + JSON (never exit 2) — the documented per-event output
 *  shapes (`permission` / `continue` / `followup_message` / `additional_context`)
 *  are the block/allow signal, not the process exit code. */
function emit(decision) {
	process.stdout.write(JSON.stringify(decision ?? {}));
	process.exit(0);
}

module.exports = {
	readStdinPayload,
	projectRoot,
	killSwitchFlagPath,
	isKillSwitchActive,
	warnLoud,
	emit,
	KILL_SWITCH_ENV,
};
