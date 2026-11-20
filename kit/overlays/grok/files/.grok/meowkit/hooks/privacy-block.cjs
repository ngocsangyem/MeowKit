#!/usr/bin/env node
// Grok PreToolUse privacy guard, registered without a matcher so it sees every tool call.
//
// The shared privacy decision Claude Code, Codex and Cursor run (lib/core/privacy.cjs, copied
// from .claude/hooks/lib) judges every path the call names and every path-like word in its
// command, so a credential file is not read or sent anywhere without the user's approval; it
// also refuses fetches aimed at loopback, private or metadata hosts.
//
// Contract: lib/grok-hook-runtime.cjs. A crash, unreadable stdin or a missing runtime config
// denies. A hook Grok stops at its timeout does not block: Grok lets that call through.
"use strict";

process.on("uncaughtException", (err) => {
	process.stderr.write(`Privacy guard could not run: ${err && err.message ? err.message : String(err)}\n`);
	process.exit(2);
});

const { commandOf, deny, pathValues, readPayload, toolInput } = require("./lib/grok-hook-runtime.cjs");
const { denyReason, loadRuntime, targetPaths } = require("./lib/hook-runtime.cjs");
const { decidePrivacy } = require("./lib/core/privacy.cjs");

if (loadRuntime(__dirname, { emitted: true }) !== "grok") {
	deny("Privacy guard cannot run: .grok/meowkit/hooks/hook-runtime-config.json is missing or not for grok. Reinstall with `mewkit init --target grok`.");
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

const result = decidePrivacy({ paths: [...targetPaths(input), ...pathValues(input), ...commandPaths], command });
if (result.exit === 2) deny(denyReason(result, "grok"));
process.exit(0);
