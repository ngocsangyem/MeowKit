#!/usr/bin/env node
// Shared kill-switch downgrade wrapper for every security-critical (failClosed)
// gate: privacy-read-gate, shell-gate, mcp-gate, tool-gate. Centralizing this in
// one module means the kill switch behaves identically across all four gates —
// no gate can accidentally forget the downgrade-and-warn contract.
"use strict";
const { warnLoud } = require("./cursor-hook-runtime.cjs");

/**
 * Decide a security gate's final output.
 *
 * @param {object} args
 * @param {boolean} args.killSwitchActive - from `isKillSwitchActive()`.
 * @param {boolean} args.blocked - true when the gate's own policy wants to deny
 *   or ask (i.e. NOT a plain allow).
 * @param {string} args.reason - human-readable reason, used in both the loud
 *   stderr warning and the downgraded `user_message`.
 * @param {object} args.blockedOutput - the JSON decision to emit when blocked
 *   and the kill switch is OFF (e.g. `{permission:"deny", user_message}`).
 * @param {object} args.allowedOutput - the JSON decision to emit when the gate
 *   is not blocking at all (e.g. `{permission:"allow"}`).
 * @returns {object} the final JSON decision to emit.
 */
function decideWithKillSwitch({ killSwitchActive, blocked, reason, blockedOutput, allowedOutput }) {
	if (!blocked) return allowedOutput;
	if (!killSwitchActive) return blockedOutput;
	warnLoud(`Gate wanted to block (${reason}) but the kill switch downgraded it to allow.`);
	return {
		...allowedOutput,
		user_message:
			`MeowKit Cursor hook kill switch is ACTIVE: a security gate would have blocked this (${reason}), ` +
			"but the kill switch downgraded it to allow. Disable the kill switch once the underlying issue is fixed.",
	};
}

module.exports = { decideWithKillSwitch };
