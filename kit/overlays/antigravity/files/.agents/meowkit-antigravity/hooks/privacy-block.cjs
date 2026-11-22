#!/usr/bin/env node
// Antigravity PreToolUse privacy guard, registered in .agents/hooks.json with the matcher "*"
// so it sees every tool call.
//
// The shared privacy decision Claude Code, Codex and Cursor run (lib/core/privacy.cjs, copied
// from .claude/hooks/lib) judges every path the call names and every path-like word in its
// command, so a credential file is not read or sent anywhere without the user's approval; it
// also refuses fetches aimed at loopback, private or metadata hosts.
//
// Contract: lib/antigravity-hook-runtime.cjs. Built from Antigravity's documentation and not yet
// seen to deny in a live run. A crash, unreadable stdin or a missing runtime config denies on
// stdout. What the host does with a hook it stops at its timeout is not documented.
"use strict";

// Written before anything is required, so a missing library still answers with a deny.
function denyOnError(err) {
	const reason = `Privacy guard could not run: ${err && err.message ? err.message : String(err)}`;
	process.stdout.write(JSON.stringify({ decision: "deny", reason }));
	process.exit(0);
}
process.on("uncaughtException", denyOnError);

const { allow, commandOf, deny, pathValues, readPayload, toolInput } = require("./lib/antigravity-hook-runtime.cjs");
const { denyReason, loadRuntime, targetPaths } = require("./lib/hook-runtime.cjs");
const { decidePrivacy } = require("./lib/core/privacy.cjs");

if (loadRuntime(__dirname, { emitted: true }) !== "antigravity") {
	deny("Privacy guard cannot run: .agents/meowkit-antigravity/hooks/hook-runtime-config.json is missing or not for antigravity. Reinstall with `mewkit init --target antigravity`.");
}

const payload = readPayload();
if (!payload) deny("Privacy guard received unreadable hook input. A read guard that cannot read the call must not allow it.");

const input = toolInput(payload);
const command = commandOf(input);

// Words in the command that look like paths (a `/`, a `.`, a leading `~`, or a bare private
// key name) go to the shared decision with the paths the call names. A bare word such as
// `secrets` in `kubectl get secrets` is not a path and is left alone.
const commandPaths = command
	.split(/[\s'"`=(><|;&@:,]+/)
	.filter((word) => word && !/^-/.test(word) && (/[./~]/.test(word) || /^id_(?:rsa|ed25519|ecdsa|dsa)$/i.test(word)));

const toolName = payload.toolCall && typeof payload.toolCall.name === "string" ? payload.toolCall.name : "";
const result = decidePrivacy({ paths: [...targetPaths(input), ...pathValues(input), ...commandPaths], command, toolName });
if (result.exit === 2) deny(denyReason(result, "antigravity"));
allow();
