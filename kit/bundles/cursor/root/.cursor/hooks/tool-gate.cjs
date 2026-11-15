#!/usr/bin/env node
// `preToolUse` adapter — matcher-scoped, security-critical for the
// file-mutation and unclassified-other buckets (failClosed: true in
// hooks.json), fail-open for read-only-query. The matcher table lives in
// lib/tool-matcher-policy.cjs: a file mutation is allowed unless it targets a
// protected path; an unclassified tool is denied.
"use strict";
const { readStdinPayload, isKillSwitchActive, emit } = require("./lib/cursor-hook-runtime.cjs");
const { decideWithKillSwitch } = require("./lib/security-gate-decision.cjs");
const { evaluateToolPolicy } = require("./lib/tool-matcher-policy.cjs");

const payload = readStdinPayload();
const verdict = evaluateToolPolicy(payload);

emit(
	decideWithKillSwitch({
		killSwitchActive: isKillSwitchActive(),
		blocked: verdict.permission !== "allow",
		reason: verdict.reason,
		blockedOutput: {
			permission: verdict.permission,
			user_message: `MeowKit tool gate (${verdict.matcherId}): ${verdict.reason}`,
		},
		allowedOutput: { permission: "allow" },
	}),
);
