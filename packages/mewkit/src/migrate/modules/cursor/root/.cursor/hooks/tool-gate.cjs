#!/usr/bin/env node
// `preToolUse` adapter — matcher-scoped, security-critical for the
// file-mutation and unclassified-other buckets (failClosed: true in
// hooks.json), fail-open for read-only-query. Thin wrapper: all decision logic
// lives in lib/tool-matcher-policy.cjs.
"use strict";
const { readStdinPayload, projectRoot, isKillSwitchActive, emit } = require("./lib/cursor-hook-runtime.cjs");
const { decideWithKillSwitch } = require("./lib/security-gate-decision.cjs");
const { evaluateToolPolicy } = require("./lib/tool-matcher-policy.cjs");

const root = projectRoot();
const payload = readStdinPayload();
const verdict = evaluateToolPolicy(payload);
const notAllowed = verdict.permission !== "allow";

emit(
	decideWithKillSwitch({
		killSwitchActive: isKillSwitchActive(root),
		blocked: notAllowed,
		reason: verdict.reason,
		blockedOutput: {
			permission: verdict.permission,
			user_message: `MeowKit tool gate (${verdict.matcherId}): ${verdict.reason}`,
		},
		allowedOutput: { permission: "allow" },
	}),
);
