// Converts .mcp.json server definitions into Codex config.toml [mcp_servers]
// entries. Stdio servers map command/args/env near 1:1; remote servers map url
// (+ headers). Unknown fields are skipped with a warning, never guessed.

import TOML from "@iarna/toml";

interface McpJsonServer {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	url?: string;
	headers?: Record<string, string>;
	type?: string;
	[key: string]: unknown;
}

const KNOWN_STDIO_FIELDS = new Set(["command", "args", "env", "type"]);
const KNOWN_REMOTE_FIELDS = new Set(["url", "headers", "type"]);

export interface McpConversionResult {
	/** TOML snippet containing only [mcp_servers.*] tables */
	content: string;
	serverNames: string[];
	warnings: string[];
}

export function convertMcpJsonToCodexToml(mcpJsonContent: string): McpConversionResult {
	const warnings: string[] = [];
	const serverNames: string[] = [];

	let parsed: { mcpServers?: Record<string, McpJsonServer> };
	try {
		parsed = JSON.parse(mcpJsonContent) as { mcpServers?: Record<string, McpJsonServer> };
	} catch (err) {
		return {
			content: "",
			serverNames: [],
			warnings: [`.mcp.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`],
		};
	}

	const servers = parsed.mcpServers;
	if (!servers || typeof servers !== "object" || Object.keys(servers).length === 0) {
		return { content: "", serverNames: [], warnings: [".mcp.json contains no mcpServers entries"] };
	}

	const mcpServers: Record<string, TOML.JsonMap> = {};
	for (const [name, server] of Object.entries(servers)) {
		const entry: TOML.JsonMap = {};
		if (typeof server.command === "string" && server.command) {
			entry.command = server.command;
			if (Array.isArray(server.args)) entry.args = server.args.filter((a): a is string => typeof a === "string");
			if (server.env && typeof server.env === "object") entry.env = { ...server.env };
			reportUnknownFields(name, server, KNOWN_STDIO_FIELDS, warnings);
		} else if (typeof server.url === "string" && server.url) {
			entry.url = server.url;
			if (server.headers && typeof server.headers === "object") entry.http_headers = { ...server.headers };
			reportUnknownFields(name, server, KNOWN_REMOTE_FIELDS, warnings);
		} else {
			warnings.push(`MCP server "${name}" has neither command nor url — skipped`);
			continue;
		}
		mcpServers[name] = entry;
		serverNames.push(name);
	}

	if (serverNames.length === 0) {
		return { content: "", serverNames, warnings };
	}

	warnings.push(
		"Project-scoped MCP servers only load in trusted projects; review the generated [mcp_servers] entries and tool approval modes before use.",
	);

	return {
		content: TOML.stringify({ mcp_servers: mcpServers }),
		serverNames,
		warnings,
	};
}

function reportUnknownFields(
	name: string,
	server: McpJsonServer,
	known: Set<string>,
	warnings: string[],
): void {
	const unknown = Object.keys(server).filter((key) => !known.has(key));
	if (unknown.length > 0) {
		warnings.push(`MCP server "${name}": no TOML mapping for field(s) ${unknown.join(", ")} — skipped`);
	}
}
