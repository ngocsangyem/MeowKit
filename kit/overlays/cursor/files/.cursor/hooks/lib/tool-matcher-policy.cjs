#!/usr/bin/env node
// Pure policy for the `preToolUse` generic-tool gate. Verified payload shape
// (docs report §4): in: `tool_name, tool_input, tool_use_id, cwd, agent_message`;
// out: `permission (allow|deny|ask), user_message, agent_message, updated_input`.
//
// Matchers are ENUMERATED up front — no unclassified catch-all. Every bucket
// below, including the fallback, has an explicit id and an explicit failClosed
// decision; hooks.json registers this same script three times under
// `preToolUse`, once per matcher pattern, each with its OWN `failClosed` value
// (see ../../hooks.json). Cursor's exact `matcher`-vs-`tool_name` matching
// semantics are not spelled out on the docs page (cross-tool convention
// assumed, same as Codex/Claude Code); this script re-derives its own decision
// from `tool_name` independent of which hooks.json entry fired, so the runtime
// policy is correct even if that assumption is wrong.
//
// IMPORTANT — `ask` is NOT enforced for `preToolUse` (verified docs: only
// `beforeShellExecution`/`beforeMCPExecution` enforce `ask` at the host). Never
// return `permission: "ask"` from this matcher table as a safety measure — the
// host will not actually pause for it. A security-relevant unclassified tool
// (one that could mutate state) MUST return `deny` (which IS enforced for
// `preToolUse`); only a tool confidently known to be read-only may `allow`.
"use strict";

function extractTargetPath(payload) {
	const input = payload && typeof payload.tool_input === "object" && payload.tool_input ? payload.tool_input : {};
	for (const key of ["path", "file_path", "filePath"]) {
		if (typeof input[key] === "string" && input[key]) return input[key];
	}
	return null;
}

// `.meowkit/state/` holds the kill-switch flag file and the reconciliation
// ledger — both trust anchors this hook bundle depends on (a tool-driven write
// there could silently disable every security gate or forge ledger trust; see
// mcp-gate.cjs / privacy-read-gate.cjs / shell-gate.cjs kill-switch checks and
// doctor-cursor.ts's checksum re-verification). This is a DIFFERENT write path
// than this hook process's OWN `node:fs` writes in telemetry-writer.cjs: those
// happen inside the hook's own process, invoked directly by Cursor's hook
// lifecycle — never through the agent's file-mutation TOOL that this matcher
// gates — so they are unaffected by this deny rule.
const PROTECTED_PATH = /(?:^|[\\/])\.(?:git|ssh|env)(?:[\\/]|$)/i;
const PROTECTED_MEOWKIT_STATE = /(?:^|[\\/])\.meowkit[\\/]state(?:[\\/]|$)/i;

function isProtectedPath(normalizedPath) {
	return PROTECTED_PATH.test(normalizedPath) || PROTECTED_MEOWKIT_STATE.test(normalizedPath);
}

const MATCHERS = [
	{
		id: "file-mutation",
		pattern: /^(?:write|edit|create|delete|remove|apply_patch|str_replace|update)/i,
		failClosed: true,
		decide: (payload) => {
			const targetPath = extractTargetPath(payload);
			if (targetPath && isProtectedPath(targetPath.replace(/\\/g, "/"))) {
				return { permission: "deny", reason: `file-mutation targets a protected path: ${targetPath}` };
			}
			return { permission: "allow", reason: "file-mutation target is not in a protected path" };
		},
	},
	{
		id: "read-only-query",
		pattern: /^(?:read|search|grep|glob|list|find|view)/i,
		failClosed: false,
		decide: () => ({ permission: "allow", reason: "read-only query tool" }),
	},
	{
		id: "unclassified-other",
		pattern: /.*/,
		failClosed: true,
		// `ask` is not host-enforced for preToolUse (see file header) — an
		// unclassified tool_name is, by definition, not confirmed read-only, so
		// the safe-side default that actually blocks at the host is `deny`.
		decide: () => ({
			permission: "deny",
			reason: "tool_name did not match an enumerated matcher; defaulting to deny (ask is not enforced for preToolUse)",
		}),
	},
];

/** Classify a `tool_name` into one of the enumerated matcher buckets above. The
 *  last entry (`unclassified-other`) always matches, so this never returns
 *  undefined — that IS the deliberate, named fallback the file header describes. */
function classify(toolName) {
	const name = typeof toolName === "string" ? toolName : "";
	return MATCHERS.find((m) => m.pattern.test(name));
}

/**
 * Evaluate the preToolUse policy for a payload. Only "allow"/"deny" are ever
 * returned — "ask" is deliberately never emitted here since it is not host-
 * enforced for preToolUse (see file header).
 * @returns {{permission: "allow"|"deny", reason: string, matcherId: string}}
 */
function evaluateToolPolicy(payload) {
	if (!payload || typeof payload !== "object" || typeof payload.tool_name !== "string" || !payload.tool_name) {
		return { permission: "deny", reason: "malformed or missing preToolUse payload (unknown schema)", matcherId: "unknown-schema" };
	}
	const matcher = classify(payload.tool_name);
	return { ...matcher.decide(payload), matcherId: matcher.id };
}

module.exports = { evaluateToolPolicy, classify, MATCHERS, PROTECTED_PATH, PROTECTED_MEOWKIT_STATE, isProtectedPath };
