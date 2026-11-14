#!/usr/bin/env node
// `beforeReadFile` adapter — security-critical (failClosed: true in hooks.json).
// Denies when either the Cursor read policy (lib/privacy-read-policy.cjs) or the
// privacy decision Claude Code runs (lib/core/privacy.cjs, copied from
// the canonical hook library) refuses the file.
"use strict";
const { readStdinPayload, projectRoot, isKillSwitchActive, emit } = require("./lib/cursor-hook-runtime.cjs");
const { decideWithKillSwitch } = require("./lib/security-gate-decision.cjs");
const { evaluateReadPolicy } = require("./lib/privacy-read-policy.cjs");
const { denyReason, loadRuntime } = require("./lib/hook-runtime.cjs");
const { decidePrivacy } = require("./lib/core/privacy.cjs");

const root = projectRoot();
const payload = readStdinPayload();
let verdict = evaluateReadPolicy(payload);
if (!verdict.blocked && loadRuntime(__dirname, { emitted: true }) !== "cursor") {
	verdict = { blocked: true, reason: ".cursor/hooks/hook-runtime-config.json is missing or not for cursor; reinstall with `mewkit init --target cursor`" };
}
if (!verdict.blocked) {
	const shared = decidePrivacy({ paths: [payload.file_path] });
	if (shared.exit === 2) verdict = { blocked: true, reason: denyReason(shared, "cursor") };
}

emit(
	decideWithKillSwitch({
		killSwitchActive: isKillSwitchActive(root),
		blocked: verdict.blocked,
		reason: verdict.reason,
		blockedOutput: { permission: "deny", user_message: `Blocked by MeowKit privacy gate: ${verdict.reason}` },
		allowedOutput: { permission: "allow" },
	}),
);
