// Phase 5 MCP profile tests: opt-in merge-not-replace application, secret-emission lint,
// missing-env diagnostic, deny-by-default, and the cloud enforcement gate. The pure merge
// decision (user keys win, conflicts reported) is exercised directly against
// `applyMcpProfiles` — there is no separate "resolver" abstraction to unit-test around, per
// the phase's premature-abstraction guard; the reconcile ledger/checksum primitives it reuses
// (cursor-ledger.ts) are already covered by cursor-reconcile-apply.test.ts.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadMcpProfileCatalog, resolveMcpProfiles, type McpProfile } from "../cursor-mcp-profile-catalog.js";
import { lintMcpProfileForSecrets, unresolvedEnvRefs } from "../cursor-mcp-profile-lint.js";
import { applyMcpProfiles, isCloudExposedProject } from "../cursor-mcp-profiles.js";
import { loadCursorBundleManifest, resolveCursorModuleDir } from "../cursor-authored-bundle.js";
import { meowkitStatePaths } from "../../../state/meowkit-state-paths.js";

const moduleDir = resolveCursorModuleDir();

function initGitRepo(dir: string, withRemote: boolean): void {
	execSync("git init -q", { cwd: dir });
	if (withRemote) execSync("git remote add origin https://example.invalid/repo.git", { cwd: dir });
}

describe("cursor MCP profile catalog (shipped content)", () => {
	it("ships at least one profile and it is schema-valid", () => {
		const catalog = loadMcpProfileCatalog(moduleDir);
		expect(catalog).not.toBeNull();
		expect(Object.keys(catalog!.profiles).length).toBeGreaterThanOrEqual(1);
	});

	it("resolves a known profile name and throws on an unknown one", () => {
		const catalog = loadMcpProfileCatalog(moduleDir)!;
		const [name] = Object.keys(catalog.profiles);
		expect(resolveMcpProfiles(catalog, [name])).toHaveLength(1);
		expect(() => resolveMcpProfiles(catalog, ["definitely-not-a-real-profile"])).toThrow(/unknown MCP profile/);
	});

	it("every shipped profile passes the secret-emission + documented-interpolation lint", () => {
		const catalog = loadMcpProfileCatalog(moduleDir)!;
		for (const [name, profile] of Object.entries(catalog.profiles)) {
			expect(lintMcpProfileForSecrets(name, profile)).toEqual([]);
		}
	});

	it("the reconciled manifest never lists a mcp.json target — MCP is never part of the base install", () => {
		const manifest = loadCursorBundleManifest(moduleDir);
		expect(manifest.entries.some((e) => e.targetPath.includes("mcp.json"))).toBe(false);
	});
});

describe("lintMcpProfileForSecrets (secret-emission guard)", () => {
	it("flags a literal secret-looking value in env — only a whole \${env:NAME} reference is allowed", () => {
		const profile: McpProfile = {
			description: "",
			transport: "stdio",
			mcpServers: { bad: { command: "npx", env: { TOKEN: "sk-abcdefghijklmnopqrstuvwx" } } },
		};
		const issues = lintMcpProfileForSecrets("bad-profile", profile);
		expect(issues.length).toBeGreaterThan(0);
		expect(issues[0]).toMatch(/env\.TOKEN/);
	});

	it("flags an undocumented interpolation token outside env", () => {
		const profile: McpProfile = {
			description: "",
			transport: "remote",
			mcpServers: { bad: { url: "https://example.invalid/${command:someUndocumentedThing}" } },
		};
		expect(lintMcpProfileForSecrets("bad-profile", profile).some((i) => i.includes("undocumented interpolation"))).toBe(true);
	});

	it("passes a clean profile using only documented interpolation vars", () => {
		const profile: McpProfile = {
			description: "",
			transport: "stdio",
			mcpServers: {
				clean: {
					command: "npx",
					args: ["-y", "some-server", "${workspaceFolder}"],
					env: { API_KEY: "${env:SOME_API_KEY}" },
				},
			},
		};
		expect(lintMcpProfileForSecrets("clean-profile", profile)).toEqual([]);
	});
});

describe("unresolvedEnvRefs (missing-env diagnostic)", () => {
	it("reports an unset env var referenced by a profile", () => {
		const varName = "MEOWKIT_TEST_MCP_UNSET_VAR_ZZZ";
		delete process.env[varName];
		const profile: McpProfile = {
			description: "",
			transport: "stdio",
			mcpServers: { s: { command: "npx", env: { X: `\${env:${varName}}` } } },
		};
		expect(unresolvedEnvRefs(profile)).toEqual([varName]);
	});

	it("reports nothing once the env var is set", () => {
		const varName = "MEOWKIT_TEST_MCP_SET_VAR_ZZZ";
		process.env[varName] = "value";
		try {
			const profile: McpProfile = {
				description: "",
				transport: "stdio",
				mcpServers: { s: { command: "npx", env: { X: `\${env:${varName}}` } } },
			};
			expect(unresolvedEnvRefs(profile)).toEqual([]);
		} finally {
			delete process.env[varName];
		}
	});
});

describe("isCloudExposedProject", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "cursor-cloud-exposed-"));
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("is false for a directory with no git repo at all", () => {
		expect(isCloudExposedProject(dir)).toBe(false);
	});

	it("is false for a git repo with no remote configured", () => {
		initGitRepo(dir, false);
		expect(isCloudExposedProject(dir)).toBe(false);
	});

	it("is true once a remote is configured", () => {
		initGitRepo(dir, true);
		expect(isCloudExposedProject(dir)).toBe(true);
	});
});

describe("applyMcpProfiles", () => {
	let target: string;
	const [profileName] = Object.keys(loadMcpProfileCatalog(moduleDir)!.profiles);

	beforeEach(() => {
		target = mkdtempSync(join(tmpdir(), "cursor-mcp-apply-"));
	});
	afterEach(() => rmSync(target, { recursive: true, force: true }));

	it("denied-by-default: an empty selection never touches .cursor/mcp.json", async () => {
		const result = await applyMcpProfiles(moduleDir, target, []);
		expect(result.applied).toBe(false);
		expect(result.blockedByCloudGate).toBe(false);
		expect(existsSync(join(target, ".cursor", "mcp.json"))).toBe(false);
	});

	it("a fresh (non-git) target merges cleanly and records the selection in the cursor ledger", async () => {
		const result = await applyMcpProfiles(moduleDir, target, [profileName], { projectRoot: target });
		expect(result.applied).toBe(true);
		expect(result.blockedByCloudGate).toBe(false);
		expect(result.addedServers.length).toBeGreaterThan(0);
		expect(result.conflictServers).toEqual([]);

		const written = JSON.parse(readFileSync(result.mcpJsonPath, "utf-8"));
		for (const server of result.addedServers) expect(written.mcpServers).toHaveProperty(server);

		const ledgerPath = meowkitStatePaths(join(target, ".meowkit")).cursorLedger;
		const ledger = JSON.parse(readFileSync(ledgerPath, "utf-8"));
		const row = ledger.installations.find((i: { item: string }) => i.item === ".cursor/mcp.json");
		expect(row).toBeDefined();
		expect(row.provider).toBe("cursor");
		expect(new Set(row.ownedSections)).toEqual(new Set(result.addedServers));
	});

	it("user server keys always win: a pre-existing DIFFERENT server definition is reported as a conflict, never overwritten", async () => {
		const catalog = loadMcpProfileCatalog(moduleDir)!;
		const profile = catalog.profiles[profileName];
		const [serverName] = Object.keys(profile.mcpServers);

		mkdirSync(join(target, ".cursor"), { recursive: true });
		const userOwned = { mcpServers: { [serverName]: { command: "my-own-server-binary" }, "my-other-server": { command: "echo" } } };
		writeFileSync(join(target, ".cursor", "mcp.json"), JSON.stringify(userOwned, null, 2));

		const result = await applyMcpProfiles(moduleDir, target, [profileName], { projectRoot: target });
		expect(result.applied).toBe(true);
		expect(result.conflictServers).toContain(serverName);
		expect(result.addedServers).not.toContain(serverName);

		const written = JSON.parse(readFileSync(join(target, ".cursor", "mcp.json"), "utf-8"));
		// The user's own definition is untouched — never overwritten by the profile's.
		expect(written.mcpServers[serverName]).toEqual(userOwned.mcpServers[serverName]);
		// A user server the profile never mentions survives the merge unchanged.
		expect(written.mcpServers["my-other-server"]).toEqual({ command: "echo" });
	});

	it("re-applying the same profile is idempotent: no new conflict, no duplicate write", async () => {
		await applyMcpProfiles(moduleDir, target, [profileName], { projectRoot: target });
		const second = await applyMcpProfiles(moduleDir, target, [profileName], { projectRoot: target });
		expect(second.applied).toBe(true);
		expect(second.conflictServers).toEqual([]);
	});

	it("throws (refuses to write) when the requested profile name is unknown", async () => {
		await expect(applyMcpProfiles(moduleDir, target, ["not-a-real-profile"], { projectRoot: target })).rejects.toThrow(
			/unknown MCP profile/,
		);
		expect(existsSync(join(target, ".cursor", "mcp.json"))).toBe(false);
	});
});

describe("applyMcpProfiles — cloud enforcement gate", () => {
	let target: string;
	const [profileName] = Object.keys(loadMcpProfileCatalog(moduleDir)!.profiles);

	beforeEach(() => {
		target = mkdtempSync(join(tmpdir(), "cursor-mcp-cloud-"));
		initGitRepo(target, true);
	});
	afterEach(() => rmSync(target, { recursive: true, force: true }));

	it("blocks (never writes) a profile selection on a cloud-exposed project without --allow-cloud-mcp", async () => {
		const result = await applyMcpProfiles(moduleDir, target, [profileName], { projectRoot: target });
		expect(result.applied).toBe(false);
		expect(result.blockedByCloudGate).toBe(true);
		expect(existsSync(join(target, ".cursor", "mcp.json"))).toBe(false);
	});

	it("applies once allowCloudMcp is explicitly true", async () => {
		const result = await applyMcpProfiles(moduleDir, target, [profileName], { allowCloudMcp: true, projectRoot: target });
		expect(result.applied).toBe(true);
		expect(result.blockedByCloudGate).toBe(false);
		expect(existsSync(join(target, ".cursor", "mcp.json"))).toBe(true);
	});
});
