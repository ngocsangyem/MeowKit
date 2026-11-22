#!/usr/bin/env node
// Payload reading and the answer form for the Antigravity hooks in this folder. No policy lives here.
//
// Antigravity hook contract (https://antigravity.google/docs/hooks, "Input and output contract",
// "PreToolUse" and "Supported tools", read 2026-11-22):
//   stdin  = JSON with camelCase fields: { toolCall: { name, args }, stepIdx, conversationId,
//            workspacePaths, transcriptPath, ... }; a tool's own arguments keep its names
//            (`run_command` takes `CommandLine` and `Cwd`, `view_file` takes `AbsolutePath`).
//   answer = stdout JSON { "decision": "allow" | "deny" | "ask" | "force_ask" | ..., "reason" }
// The page says nothing of exit codes, of what a crash or malformed output does, of what the
// host does when a hook passes its timeout, or of the directory the command runs in. So every
// answer here is stdout JSON with exit 0 (the one form the page documents), and every failure
// this folder can see becomes a deny. A hook the host stops at its timeout, or one whose `node`
// cannot start, is outside what a script can answer: a live run has to show what happens.
"use strict";
const { readFileSync } = require("node:fs");

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The hook's stdin as an object, or null when it is empty, unreadable or not JSON. */
function readPayload() {
	try {
		const data = JSON.parse(readFileSync(0, "utf-8"));
		return isObject(data) ? data : null;
	} catch {
		return null;
	}
}

/** The call's `toolCall.args` object; empty when the payload carries none. */
function toolInput(payload) {
	const call = payload && payload.toolCall;
	return isObject(call) && isObject(call.args) ? call.args : {};
}

/**
 * Field names a shell command may arrive under; the first that holds a string is the command.
 * `CommandLine` is the documented argument of `run_command`; the others are the spellings the
 * other runtimes use, kept so a renamed argument is still judged rather than passed.
 */
const COMMAND_FIELDS = ["CommandLine", "commandLine", "command", "cmd"];

/** The shell command a call runs, or "" when no known field carries one. */
function commandOf(input) {
	const field = COMMAND_FIELDS.find((key) => typeof input[key] === "string");
	return field ? input[field] : "";
}

/** A field whose name says it holds a path, whatever the tool calls it. */
const PATH_FIELD = /path|file|dir|target|uri/i;

/**
 * Every string under a path-named field of the tool's arguments, lists included, so a path
 * carried under a field name this folder does not know is still judged. Search patterns,
 * queries and file content are not paths and are left out.
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
 * Where the call runs: the command's own `Cwd`, then the first of the payload's
 * `workspacePaths`, then this process's directory. The command's directory comes first because
 * a command run inside a linked worktree ships from that worktree.
 */
function sessionRoot(payload) {
	const cwd = toolInput(payload).Cwd;
	if (typeof cwd === "string" && cwd) return cwd;
	const roots = payload && payload.workspacePaths;
	if (Array.isArray(roots) && typeof roots[0] === "string" && roots[0]) return roots[0];
	return process.cwd();
}

/** Answer `decision` (with `reason` when there is one) on stdout and end the hook. */
function answer(decision, reason) {
	process.stdout.write(JSON.stringify(reason ? { decision, reason } : { decision }));
	process.exit(0);
}

/** Let the call go on to the next hook or the host's own policy. */
const allow = () => answer("allow");

/** Refuse the call with `reason`. */
const deny = (reason) => answer("deny", reason);

module.exports = { allow, answer, commandOf, deny, pathValues, readPayload, sessionRoot, toolInput };
