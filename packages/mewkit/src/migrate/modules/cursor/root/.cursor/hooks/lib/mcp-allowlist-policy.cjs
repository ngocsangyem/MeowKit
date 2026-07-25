#!/usr/bin/env node
// Pure policy for the `beforeMCPExecution` security gate. Verified payload
// shape (docs report §4): in: `command` or `tool_name/tool_input` + `url`/
// `command`; out: `permission (allow|deny|ask)`.
//
// GAP (flagged, not guessed): the docs page does not spell out which literal
// field identifies the target MCP SERVER on this event (only that `tool_name`
// and/or `command`/`url` are present). `extractServerName` below defensively
// parses the cross-tool `mcp__<server>__<tool>` naming convention (the SAME
// double-underscore delimiter Claude Code uses for its `mcp__server__tool`
// identifiers) — double-underscore is used deliberately, not a single `-`/`_`,
// because server and tool names may themselves contain hyphens. Returns null —
// treated as an unverifiable schema, i.e. DENY — when it cannot confidently
// identify a server. This is the one payload field this phase could not fully
// verify from the docs report; default-deny applies.
"use strict";
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

/** Load the set of server names configured in the project's `.cursor/mcp.json`.
 *  Returns null when the file is absent, unparseable, or has no `mcpServers`
 *  object — all three mean "nothing is approved" (fail closed: no config ⇒ no
 *  server is on the allowlist). */
function loadConfiguredServers(root) {
	const mcpPath = join(root, ".cursor", "mcp.json");
	if (!existsSync(mcpPath)) return null;
	try {
		const parsed = JSON.parse(readFileSync(mcpPath, "utf-8"));
		const servers = parsed && typeof parsed === "object" ? parsed.mcpServers : null;
		if (!servers || typeof servers !== "object") return null;
		return new Set(Object.keys(servers));
	} catch {
		return null;
	}
}

/** Best-effort server-name extraction — see file header GAP note. Deterministic
 *  string ops (not a greedy regex): `mcp__` prefix, then everything up to the
 *  NEXT literal `__` is the server name — this correctly handles hyphenated
 *  server/tool names (a greedy `[\w-]+` regex would over-consume through
 *  embedded hyphens; a lazy one would stop at the first embedded hyphen). */
function extractServerName(payload) {
	if (!payload || typeof payload !== "object") return null;
	for (const candidate of [payload.server, payload.mcpServer, payload.serverName]) {
		if (typeof candidate === "string" && candidate) return candidate;
	}
	const toolName = typeof payload.tool_name === "string" ? payload.tool_name : "";
	if (!toolName.toLowerCase().startsWith("mcp__")) return null;
	const rest = toolName.slice(5);
	const delimiterIndex = rest.indexOf("__");
	if (delimiterIndex <= 0) return null;
	return rest.slice(0, delimiterIndex);
}

/**
 * Evaluate the MCP allowlist policy for a `beforeMCPExecution` payload.
 * @returns {{blocked: boolean, reason: string}}
 */
function evaluateMcpPolicy(payload, root) {
	if (!payload || typeof payload !== "object") {
		return { blocked: true, reason: "malformed or missing beforeMCPExecution payload (unknown schema)" };
	}
	const configured = loadConfiguredServers(root);
	if (!configured || configured.size === 0) {
		return { blocked: true, reason: "no .cursor/mcp.json server allowlist configured" };
	}
	const server = extractServerName(payload);
	if (!server) {
		return { blocked: true, reason: "could not identify the target MCP server from the payload (unverified schema field)" };
	}
	if (!configured.has(server)) {
		return { blocked: true, reason: `MCP server '${server}' is not in the project's .cursor/mcp.json allowlist` };
	}
	return { blocked: false, reason: `MCP server '${server}' is in the project allowlist` };
}

module.exports = { evaluateMcpPolicy, extractServerName, loadConfiguredServers };
