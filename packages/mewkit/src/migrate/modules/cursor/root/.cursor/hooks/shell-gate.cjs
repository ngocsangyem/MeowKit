#!/usr/bin/env node
// `beforeShellExecution` adapter — security-critical (failClosed: true in
// hooks.json). Thin wrapper: all decision logic lives in lib/shell-guard-policy.cjs.
"use strict";
const { readStdinPayload, projectRoot, isKillSwitchActive, emit } = require("./lib/cursor-hook-runtime.cjs");
const { decideWithKillSwitch } = require("./lib/security-gate-decision.cjs");
const { evaluateShellPolicy } = require("./lib/shell-guard-policy.cjs");

const root = projectRoot();
const payload = readStdinPayload();
const verdict = evaluateShellPolicy(payload);
const notAllowed = verdict.blocked || verdict.ask;
const decisionPermission = verdict.blocked ? "deny" : "ask";

emit(
	decideWithKillSwitch({
		killSwitchActive: isKillSwitchActive(root),
		blocked: notAllowed,
		reason: verdict.reason,
		blockedOutput: { permission: decisionPermission, user_message: `MeowKit shell gate: ${verdict.reason}` },
		allowedOutput: { permission: "allow" },
	}),
);
