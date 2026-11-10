#!/usr/bin/env node
// Codex PreToolUse privacy guard (Bash matcher).
//
// Two refusals. A command that references a sensitive file — .env*, *.pem, *.key, *.keystore,
// credentials, an *.ssh/* path, or an SSH private key — is denied so a secret cannot be read or
// exfiltrated without explicit user approval (injection-rules R4). Then the shared privacy
// decision Claude Code runs (lib/core/privacy.cjs, copied from .claude/hooks/lib) refuses
// fetches aimed at loopback, private or metadata hosts and paths the call names.
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
	deny("Privacy guard cannot run: .codex/hooks/hook-runtime-config.json is missing or not for codex. Reinstall with `mewkit migrate codex`.");
}

const input = readPayload();
if (!input) deny("Privacy guard received unreadable hook input. A read guard that cannot read the command must not allow it.");

const toolInput = input && typeof input.tool_input === "object" && input.tool_input ? input.tool_input : {};
const command = typeof toolInput.command === "string" ? toolInput.command : "";

// Sensitive-file references, in a file-path-like context (extension or path marker) so a
// bare word like "secret" in prose does not trip the guard. Mirrors the R4 path patterns.
const SENSITIVE_FILE =
	/(?:^|[\s'"`=(><|;&@])(?:[\w./~-]*\.env(?:\.[\w-]+)?|[\w./~-]*\.(?:pem|key|keystore)|[\w./~-]*credentials[\w./-]*|[\w./~-]*secrets?\.[\w]+|[\w./~-]*\.ssh\/[\w./-]*|id_(?:rsa|ed25519|dsa|ecdsa))(?:$|[\s'"`:,;&|)])/i;

if (SENSITIVE_FILE.test(command)) {
	deny(
		"Command references a sensitive file (.env / *.pem / *.key / *.keystore / credentials / secret file / SSH key). " +
			"Get explicit user approval before reading or transmitting it (injection-rules R4).",
	);
}

const result = decidePrivacy({ paths: targetPaths(toolInput), command });
if (result.exit === 2) deny(denyReason(result, "codex"));
process.exit(0);
