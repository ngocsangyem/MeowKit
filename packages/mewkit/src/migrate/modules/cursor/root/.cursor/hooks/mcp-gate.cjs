#!/usr/bin/env node
// `beforeMCPExecution` adapter — security-critical (failClosed: true in
// hooks.json). Thin wrapper: all decision logic lives in lib/mcp-allowlist-policy.cjs.
"use strict";
const { readStdinPayload, projectRoot, isKillSwitchActive, emit } = require("./lib/cursor-hook-runtime.cjs");
const { decideWithKillSwitch } = require("./lib/security-gate-decision.cjs");
const { evaluateMcpPolicy } = require("./lib/mcp-allowlist-policy.cjs");

const root = projectRoot();
const payload = readStdinPayload();
const verdict = evaluateMcpPolicy(payload, root);

emit(
	decideWithKillSwitch({
		killSwitchActive: isKillSwitchActive(root),
		blocked: verdict.blocked,
		reason: verdict.reason,
		blockedOutput: { permission: "deny", user_message: `Blocked by MeowKit MCP allowlist gate: ${verdict.reason}` },
		allowedOutput: { permission: "allow" },
	}),
);
