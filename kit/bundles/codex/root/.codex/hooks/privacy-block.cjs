#!/usr/bin/env node
// Codex PreToolUse privacy guard (Bash matcher).
//
// The shared privacy decision Claude Code and Cursor run (lib/core/privacy.cjs, copied from
// .claude/hooks/lib) judges every path the command names and every path the call carries, so
// a credential file cannot be read or exfiltrated without explicit user approval
// (injection-rules R4); it also refuses fetches aimed at loopback, private or metadata hosts.
//
// Codex hook contract (learn.chatgpt.com/docs/hooks, verified 2026-07-26):
//   stdin  = JSON { hook_event_name, tool_name, tool_input: { command }, cwd, ... }
//   deny   = stdout JSON { hookSpecificOutput: { hookEventName: "PreToolUse",
//            permissionDecision: "deny", permissionDecisionReason } }, exit 0
//   allow  = exit 0 with no stdout
//
// Fails closed: unreadable stdin, a missing or foreign runtime config, or a crash denies.
"use strict";

process.on("uncaughtException", (err) => {
	process.stderr.write(`Privacy guard could not run: ${err && err.message ? err.message : String(err)}\n`);
	process.exit(2);
});

const { readPayload, deny } = require("./lib/codex-hook-runtime.cjs");
const { denyReason, loadRuntime, targetPaths } = require("./lib/hook-runtime.cjs");
const { decidePrivacy } = require("./lib/core/privacy.cjs");

if (loadRuntime(__dirname, { emitted: true }) !== "codex") {
	deny("Privacy guard cannot run: .codex/hooks/hook-runtime-config.json is missing or not for codex. Reinstall with `mewkit init --target codex`.");
}

const input = readPayload();
if (!input) deny("Privacy guard received unreadable hook input. A read guard that cannot read the command must not allow it.");

const toolInput = input && typeof input.tool_input === "object" && input.tool_input ? input.tool_input : {};
const command = typeof toolInput.command === "string" ? toolInput.command : "";

// Words in the command that look like paths (a `/`, a `.`, a leading `~`, or a bare private
// key name) go to the shared decision with the paths the call names, so Codex refuses exactly
// the names Claude Code and Cursor refuse. A bare word such as `secrets` in
// `kubectl get secrets` is not a path and is left alone.
const commandPaths = command
	.split(/[\s'"`=(><|;&@:,]+/)
	.filter((word) => word && !/^-/.test(word) && (/[./~]/.test(word) || /^id_(?:rsa|ed25519|ecdsa|dsa)$/i.test(word)));

const result = decidePrivacy({ paths: [...targetPaths(toolInput), ...commandPaths], command });
if (result.exit === 2) deny(denyReason(result, "codex"));
process.exit(0);
