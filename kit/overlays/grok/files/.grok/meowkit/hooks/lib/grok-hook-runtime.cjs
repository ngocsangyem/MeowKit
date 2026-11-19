#!/usr/bin/env node
// Payload reading and the deny form for the Grok hooks in this folder. No policy lives here.
//
// Grok hook contract (docs.x.ai/build/features/hooks, "The script contract", read 2026-11-19):
//   stdin  = JSON { hookEventName, sessionId, cwd, workspaceRoot, toolName, toolInput }
//   deny   = stdout JSON { "decision": "deny", "reason": "..." }; exit code 2 denies as well
//   allow  = exit 0
//   Timeouts, crashes and malformed output let the call through, and PreToolUse is the only
//   event that can block.
// The page does not name the fields inside `toolInput`. A shell command is read from
// the fields in COMMAND_FIELDS; one Grok carried under another name would pass both guards unjudged.
"use strict";
const { readFileSync } = require("node:fs");

/** The hook's stdin as an object, or null when it is empty, unreadable or not JSON. */
function readPayload() {
	try {
		const data = JSON.parse(readFileSync(0, "utf-8"));
		return data !== null && typeof data === "object" && !Array.isArray(data) ? data : null;
	} catch {
		return null;
	}
}

/** The call's `toolInput` object; empty when the payload carries none. */
function toolInput(payload) {
	const input = payload && payload.toolInput;
	return input !== null && typeof input === "object" && !Array.isArray(input) ? input : {};
}

/** Field names a shell command may arrive under; the first that holds a string is the command. */
const COMMAND_FIELDS = ["command", "cmd", "script", "commandLine"];

/** The shell command a call runs, or "" when no known field carries one. */
function commandOf(input) {
	const field = COMMAND_FIELDS.find((key) => typeof input[key] === "string");
	return field ? input[field] : "";
}

/** A field whose name says it holds a path, whatever the tool calls it. */
const PATH_FIELD = /path|file|dir|target|uri/i;

/**
 * Every string under a path-named field of `toolInput`, lists included, so a path carried under
 * a field name this folder does not know is still judged. Search patterns, queries and file
 * content are not paths and are left out.
 */
function pathValues(input) {
	const out = [];
	for (const [key, value] of Object.entries(input)) {
		if (!PATH_FIELD.test(key)) continue;
		for (const item of Array.isArray(value) ? value : [value]) {
			if (typeof item === "string" && item) out.push(item);
		}
	}
	return out;
}

/**
 * Where the call runs: the payload's `cwd`, then its `workspaceRoot`, then this process's. The
 * cwd comes first because a session inside a linked worktree ships from that worktree.
 */
function sessionRoot(payload) {
	for (const key of ["cwd", "workspaceRoot"]) {
		if (payload && typeof payload[key] === "string" && payload[key]) return payload[key];
	}
	return process.env.GROK_WORKSPACE_ROOT || process.cwd();
}

/** Deny the call with `reason`, in both forms the contract documents. */
function deny(reason) {
	process.stdout.write(JSON.stringify({ decision: "deny", reason }));
	process.exit(2);
}

module.exports = { commandOf, deny, pathValues, readPayload, sessionRoot, toolInput };
