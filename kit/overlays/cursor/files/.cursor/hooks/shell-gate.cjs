#!/usr/bin/env node
// `beforeShellExecution` adapter — security-critical (failClosed: true in
// hooks.json). Thin wrapper: all decision logic lives in lib/shell-guard-policy.cjs.
"use strict";
const { readStdinPayload, isKillSwitchActive, emit } = require("./lib/cursor-hook-runtime.cjs");
const { decideWithKillSwitch } = require("./lib/security-gate-decision.cjs");
const { evaluateShellPolicy } = require("./lib/shell-guard-policy.cjs");

const payload = readStdinPayload();
const verdict = evaluateShellPolicy(payload);
const notAllowed = verdict.blocked || verdict.ask;
const decisionPermission = verdict.blocked ? "deny" : "ask";

emit(
	decideWithKillSwitch({
		killSwitchActive: isKillSwitchActive(),
		blocked: notAllowed,
		reason: verdict.reason,
		blockedOutput: { permission: decisionPermission, user_message: `Shell gate: ${verdict.reason}` },
		allowedOutput: { permission: "allow" },
	}),
);
