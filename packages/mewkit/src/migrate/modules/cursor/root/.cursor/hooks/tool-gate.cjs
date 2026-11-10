#!/usr/bin/env node
// `preToolUse` adapter — matcher-scoped, security-critical for the
// file-mutation and unclassified-other buckets (failClosed: true in
// hooks.json), fail-open for read-only-query. The matcher table lives in
// lib/tool-matcher-policy.cjs.
//
// A file mutation that passes the matcher table then goes through the same
// Gate 1 decision Claude Code runs (lib/core/plan-gate.cjs, copied from
// the canonical hook library): a source write needs an approved plan whose receipt still
// matches its body, and a signed sprint contract. A missing runtime config or
// an unresolvable project root denies that write.
"use strict";
const { readStdinPayload, isKillSwitchActive, emit } = require("./lib/cursor-hook-runtime.cjs");
const { decideWithKillSwitch } = require("./lib/security-gate-decision.cjs");
const { evaluateToolPolicy } = require("./lib/tool-matcher-policy.cjs");
const { denyReason, loadRuntime, nonSourceTrees, targetPaths } = require("./lib/hook-runtime.cjs");
const { enterGuardRoot } = require("./lib/project-root.cjs");
const { decidePlanGate } = require("./lib/core/plan-gate.cjs");

const payload = readStdinPayload();
const root = enterGuardRoot(payload && typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd());

/** The Gate 1 verdict for a file mutation the matcher table allowed. */
function planGate() {
	if (loadRuntime(__dirname, { emitted: true }) !== "cursor") {
		return { permission: "deny", reason: ".cursor/hooks/hook-runtime-config.json is missing or not for cursor; reinstall with `mewkit migrate cursor`", matcherId: "gate-1" };
	}
	if (!root) return { permission: "deny", reason: "cannot locate the project root Gate 1 guards", matcherId: "gate-1" };
	// A write whose target cannot be read is an unknown payload shape, not a write to nothing.
	const paths = targetPaths(payload.tool_input);
	if (paths.length === 0) return { permission: "deny", reason: "cannot tell which files this write touches", matcherId: "gate-1" };
	const result = decidePlanGate({
		root,
		paths,
		env: process.env,
		extraNonSource: nonSourceTrees("cursor"),
	});
	if (result.stderr.length && result.exit !== 2) process.stderr.write(`${result.stderr.join("\n")}\n`);
	return result.exit === 2
		? { permission: "deny", reason: denyReason(result, "cursor"), matcherId: "gate-1" }
		: { permission: "allow", reason: "Gate 1 passed", matcherId: "gate-1" };
}

let verdict = evaluateToolPolicy(payload);
if (verdict.permission === "allow" && verdict.matcherId === "file-mutation") verdict = planGate();
const notAllowed = verdict.permission !== "allow";

emit(
	decideWithKillSwitch({
		killSwitchActive: isKillSwitchActive(root || process.cwd()),
		blocked: notAllowed,
		reason: verdict.reason,
		blockedOutput: {
			permission: verdict.permission,
			user_message: `MeowKit tool gate (${verdict.matcherId}): ${verdict.reason}`,
		},
		allowedOutput: { permission: "allow" },
	}),
);
