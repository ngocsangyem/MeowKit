#!/usr/bin/env node
// `beforeReadFile` adapter — security-critical (failClosed: true in hooks.json).
// Thin wrapper: all decision logic lives in lib/privacy-read-policy.cjs.
"use strict";
const { readStdinPayload, projectRoot, isKillSwitchActive, emit } = require("./lib/cursor-hook-runtime.cjs");
const { decideWithKillSwitch } = require("./lib/security-gate-decision.cjs");
const { evaluateReadPolicy } = require("./lib/privacy-read-policy.cjs");

const root = projectRoot();
const payload = readStdinPayload();
const verdict = evaluateReadPolicy(payload);

emit(
	decideWithKillSwitch({
		killSwitchActive: isKillSwitchActive(root),
		blocked: verdict.blocked,
		reason: verdict.reason,
		blockedOutput: { permission: "deny", user_message: `Blocked by MeowKit privacy gate: ${verdict.reason}` },
		allowedOutput: { permission: "allow" },
	}),
);
