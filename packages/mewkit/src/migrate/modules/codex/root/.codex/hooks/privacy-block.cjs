#!/usr/bin/env node
// Codex PreToolUse privacy guard (Bash matcher).
//
// Ports the toolkit's privacy-block policy (injection-rules R4) to the native Codex hook
// contract: a Bash tool call whose command references a sensitive file — .env*, *.pem,
// *.key, *.keystore, credentials, an *.ssh/* path, or an SSH private key — is DENIED so
// a secret cannot be read or exfiltrated without explicit user approval.
//
// Codex hook contract (developers.openai.com/codex/hooks, verified 2026-07-23):
//   stdin  = JSON { hook_event_name, tool_name, tool_input: { command }, cwd, ... }
//   deny   = stdout JSON { hookSpecificOutput: { hookEventName: "PreToolUse",
//            permissionDecision: "deny", permissionDecisionReason } }, exit 0
//   allow  = exit 0 with no stdout
// Codex PreToolUse intercepts Bash, apply_patch/file-edits, and MCP calls (not every
// shell path) — this hook is defense-in-depth layered under the authoritative CLI gate.
"use strict";
const { readFileSync } = require("node:fs");

/** Emit a PreToolUse deny decision and exit (exit 0 + JSON is the documented deny form). */
function deny(reason) {
	process.stdout.write(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "deny",
				permissionDecisionReason: reason,
			},
		}),
	);
	process.exit(0);
}

let input;
try {
	input = JSON.parse(readFileSync(0, "utf-8"));
} catch {
	process.exit(0); // no/invalid stdin → allow (fail-open on parse; the CLI gate is authoritative)
}

const toolInput = input && typeof input.tool_input === "object" && input.tool_input ? input.tool_input : {};
const command = typeof toolInput.command === "string" ? toolInput.command : "";
if (!command) process.exit(0);

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

process.exit(0);
