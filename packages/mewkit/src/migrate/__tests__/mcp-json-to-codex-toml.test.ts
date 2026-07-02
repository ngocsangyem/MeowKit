import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { convertMcpJsonToCodexToml } from "../converters/mcp-json-to-codex-toml.js";
import { installCodexMcpServers } from "../hooks/codex-mcp-installer.js";

describe("convertMcpJsonToCodexToml", () => {
	it("maps stdio servers to command/args/env tables", () => {
		const result = convertMcpJsonToCodexToml(
			JSON.stringify({
				mcpServers: {
					context7: { command: "npx", args: ["-y", "@upstash/context7-mcp"], env: { API_KEY: "x" } },
				},
			}),
		);
		expect(result.serverNames).toEqual(["context7"]);
		expect(result.content).toContain("[mcp_servers.context7]");
		expect(result.content).toContain('command = "npx"');
		expect(result.content).toContain('args = [ "-y", "@upstash/context7-mcp" ]');
		expect(result.content).toContain("[mcp_servers.context7.env]");
		expect(result.content).toContain('API_KEY = "x"');
	});

	it("maps remote servers to url tables with headers", () => {
		const result = convertMcpJsonToCodexToml(
			JSON.stringify({
				mcpServers: { remote: { url: "https://example.com/mcp", headers: { "X-Custom": "v" } } },
			}),
		);
		expect(result.content).toContain("[mcp_servers.remote]");
		expect(result.content).toContain('url = "https://example.com/mcp"');
		expect(result.content).toContain("[mcp_servers.remote.http_headers]");
		expect(result.content).toContain('X-Custom = "v"');
	});

	it("always includes the trust caveat when servers convert", () => {
		const result = convertMcpJsonToCodexToml(JSON.stringify({ mcpServers: { a: { command: "x" } } }));
		expect(result.warnings.some((w) => w.includes("trusted projects"))).toBe(true);
	});

	it("skips servers with neither command nor url and warns on unknown fields", () => {
		const result = convertMcpJsonToCodexToml(
			JSON.stringify({
				mcpServers: {
					broken: { note: "?" },
					custom: { command: "x", timeout: 5 },
				},
			}),
		);
		expect(result.serverNames).toEqual(["custom"]);
		expect(result.warnings.some((w) => w.includes('"broken"'))).toBe(true);
		expect(result.warnings.some((w) => w.includes("timeout"))).toBe(true);
	});

	it("reports invalid JSON instead of throwing", () => {
		const result = convertMcpJsonToCodexToml("not json");
		expect(result.content).toBe("");
		expect(result.warnings[0]).toContain("not valid JSON");
	});
});

describe("installCodexMcpServers", () => {
	const originalCwd = process.cwd();

	afterEach(() => {
		process.chdir(originalCwd);
	});

	it("merges a sentinel-managed block and stays idempotent across re-runs", async () => {
		const projectDir = await mkdtemp(join(tmpdir(), "mewkit-mcp-install-"));
		process.chdir(projectDir);
		const configPath = join(projectDir, ".codex", "config.toml");
		await installCodexMcpServers('[mcp_servers.a]\ncommand = "x"\n', { global: false });

		// Simulate user content added around the managed block.
		const afterFirst = await readFile(configPath, "utf-8");
		await writeFile(configPath, `approval_policy = "on-request"\n\n${afterFirst}`, "utf-8");

		await installCodexMcpServers('[mcp_servers.a]\ncommand = "y"\n', { global: false });
		const final = await readFile(configPath, "utf-8");

		expect(final).toContain('approval_policy = "on-request"');
		expect(final.match(/managed-mcp-servers-start/g)).toHaveLength(1);
		expect(final).toContain('command = "y"');
		expect(final).not.toContain('command = "x"');
	});
});
