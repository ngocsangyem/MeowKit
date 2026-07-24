#!/usr/bin/env node
// Pure policy for the `beforeShellExecution` security gate. Verified payload
// shape (docs report §4): in: `command`; out: `permission (allow|deny|ask),
// user_message, agent_message`.
"use strict";

// Deny outright: patterns with a high-confidence destructive/irreversible blast
// radius (data loss, disk wipe, forced history rewrite, remote-script execution).
const DENY_PATTERNS = [
	{ id: "rm-rf-root-or-home", re: /\brm\s+(?:-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*)\s+(?:\/|~|\$HOME|\*)(?:\s|$)/i },
	{ id: "git-hard-reset", re: /\bgit\s+reset\s+--hard\b/i },
	{ id: "git-clean-force", re: /\bgit\s+clean\s+-[a-z]*f[a-z]*d?[a-z]*/i },
	{ id: "disk-wipe", re: /\b(?:mkfs\.\w+|dd\s+if=)/i },
	{ id: "sql-drop-or-truncate", re: /\b(?:drop\s+(?:table|database)|truncate\s+table)\b/i },
	{ id: "chmod-777-recursive", re: /\bchmod\s+-R\s+0?777\b/i },
	{ id: "pipe-remote-script-to-shell", re: /\b(?:curl|wget)\b[^\n]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/i },
	{ id: "fork-bomb", re: /:\(\)\s*\{\s*:\|\s*:&\s*\}\s*;\s*:/ },
];

// Ask (not an automatic deny): privilege escalation is not always destructive,
// but warrants an explicit human confirmation rather than silent pass-through.
const ASK_PATTERNS = [{ id: "sudo-privileged", re: /\bsudo\b/i }];

/**
 * Evaluate the shell-gate policy for a `beforeShellExecution` payload.
 * @returns {{blocked: boolean, ask: boolean, reason: string}}
 */
function evaluateShellPolicy(payload) {
	if (!payload || typeof payload !== "object") {
		return { blocked: true, ask: false, reason: "malformed or missing beforeShellExecution payload (unknown schema)" };
	}
	const command = typeof payload.command === "string" ? payload.command : null;
	if (command === null) {
		return { blocked: true, ask: false, reason: "beforeShellExecution payload missing command (unknown schema)" };
	}
	for (const { id, re } of DENY_PATTERNS) {
		if (re.test(command)) return { blocked: true, ask: false, reason: `destructive command pattern (${id})` };
	}
	for (const { id, re } of ASK_PATTERNS) {
		if (re.test(command)) return { blocked: false, ask: true, reason: `privilege-escalation pattern (${id})` };
	}
	return { blocked: false, ask: false, reason: "no destructive or privileged pattern matched" };
}

module.exports = { evaluateShellPolicy, DENY_PATTERNS, ASK_PATTERNS };
