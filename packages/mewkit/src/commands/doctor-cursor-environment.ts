import fs from "node:fs";
import path from "node:path";
import type { DiagResult } from "./doctor-checks.js";
import { readCursorLedger } from "../migrate/reconcile/cursor-ledger.js";
import { meowkitStatePaths } from "../state/meowkit-state-paths.js";
import { isCloudExposedProject } from "../migrate/modules/cursor-mcp-profiles.js";
import { unresolvedEnvRefs } from "../migrate/modules/cursor-mcp-profile-lint.js";
import type { McpProfile } from "../migrate/modules/cursor-mcp-profile-catalog.js";

// Phase 5 environment diagnostics: per-runtime-environment rows (ide-local / cli-headless /
// cloud / tab) from `compliance/runtime-environment-matrix.json`, plus MCP profile health
// basics. Split out of doctor-cursor.ts (hooks.json shape / version gate / checksum
// re-verification / kill-switch) to keep that file under the project's ~150-line join-point
// budget — `checkCursor` in doctor-cursor.ts calls `checkCursorEnvironment` and concatenates
// the results, so callers see one flat DiagResult[] regardless of the split.

interface StatusBlock {
	status: "documented" | "undocumented" | "not-applicable";
	note?: string;
	[key: string]: unknown;
}
interface EnvironmentRow {
	environment: "ide-local" | "cli-headless" | "cloud" | "tab";
	hookEventsActive: StatusBlock & { events: string[] };
	skillsDiscoveryPaths: StatusBlock & { paths: string[] };
	agentsDiscoveryPaths: StatusBlock & { paths: string[] };
	rulesDiscoveryPaths: StatusBlock & { paths: string[] };
	mcpTransportsSupported: StatusBlock & { transports: string[] };
	sandboxRunModeGuidance: string;
	cloudCompatibilitySummary: string;
}
interface RuntimeEnvironmentMatrix {
	environments: EnvironmentRow[];
}

/** Worst-of severity across a row's own status fields: any `undocumented` anywhere makes the
 *  whole row `warn` (surface the gap, never silently `pass`); all-`not-applicable` is `na`;
 *  otherwise `pass`. Never "a single support flag" — the row's detail always names the parts. */
function rowStatus(row: EnvironmentRow): "pass" | "warn" | "na" {
	const parts = [row.hookEventsActive, row.skillsDiscoveryPaths, row.agentsDiscoveryPaths, row.rulesDiscoveryPaths, row.mcpTransportsSupported];
	if (parts.some((p) => p.status === "undocumented")) return "warn";
	if (parts.every((p) => p.status === "not-applicable")) return "na";
	return "pass";
}

function renderEnvironmentRow(row: EnvironmentRow): DiagResult {
	const detail =
		`hooks: ${row.hookEventsActive.status} (${row.hookEventsActive.events.length} active)` +
		` | skills: ${row.skillsDiscoveryPaths.status}` +
		` | agents: ${row.agentsDiscoveryPaths.status}` +
		` | rules: ${row.rulesDiscoveryPaths.status}` +
		` | mcp: ${row.mcpTransportsSupported.status} (${row.mcpTransportsSupported.transports.join(", ") || "none"})` +
		` | cloud: ${row.cloudCompatibilitySummary}` +
		` | guidance: ${row.sandboxRunModeGuidance}`;
	return { status: rowStatus(row), name: `Cursor environment: ${row.environment}`, detail };
}

/** Read + render the runtime-environment-matrix rows, or a single warn when the bundle predates
 *  Phase 5 (no matrix file shipped yet). */
function checkEnvironmentMatrix(moduleDir: string): DiagResult[] {
	const matrixPath = path.join(moduleDir, "compliance", "runtime-environment-matrix.json");
	if (!fs.existsSync(matrixPath)) {
		return [{ status: "warn", name: "Cursor runtime-environment matrix", detail: `missing: ${matrixPath}` }];
	}
	let matrix: RuntimeEnvironmentMatrix;
	try {
		matrix = JSON.parse(fs.readFileSync(matrixPath, "utf-8"));
	} catch (e) {
		return [{ status: "fail", name: "Cursor runtime-environment matrix", detail: `invalid JSON: ${(e as Error).message}` }];
	}
	return matrix.environments.map(renderEnvironmentRow);
}

/** MCP profile health: which server keys mewkit owns in `.cursor/mcp.json` (from the ledger's
 *  `ownedSections`), whether any `${env:NAME}` they reference is unset, and — the hard gate —
 *  whether an owned profile sits in a project that may run as a Cursor Cloud Agent, where
 *  `beforeMCPExecution` has no local enforcement equivalent (docs-confirmed gap). This FAILS,
 *  never just notes, because the enforcement gap is real regardless of how the profile was
 *  selected. */
async function checkMcpProfileHealth(dir: string, moduleDir: string): Promise<DiagResult[]> {
	const mcpJsonPath = path.join(dir, ".cursor", "mcp.json");
	if (!fs.existsSync(mcpJsonPath)) {
		return [{ status: "pass", name: "Cursor MCP profile(s)", detail: "no .cursor/mcp.json — opt-in MCP surface untouched." }];
	}

	const ledgerPath = meowkitStatePaths(path.join(dir, ".meowkit")).cursorLedger;
	const ledger = await readCursorLedger(ledgerPath);
	const row = ledger.installations.find((r) => r.provider === "cursor" && r.item === ".cursor/mcp.json");
	const ownedServers = row?.ownedSections ?? [];

	const results: DiagResult[] = [];
	if (ownedServers.length === 0) {
		results.push({
			status: "pass",
			name: "Cursor MCP profile(s)",
			detail: ".cursor/mcp.json exists but no server in it is mewkit-owned (user-authored, or ledger not yet recorded).",
		});
		return results;
	}

	results.push({
		status: "pass",
		name: "Cursor MCP profile(s) installed",
		detail: `mewkit-owned server(s): ${ownedServers.join(", ")} (source: ${row?.sourcePath ?? "unknown"})`,
	});

	const unresolved = await collectUnresolvedEnvRefs(mcpJsonPath, ownedServers);
	results.push(
		unresolved.length === 0
			? { status: "pass", name: "Cursor MCP env references", detail: "every ${env:NAME} reference in owned servers resolves." }
			: {
					status: "warn",
					name: "Cursor MCP env references",
					detail: `unset env var(s) referenced by an owned MCP server: ${unresolved.join(", ")}`,
					fix: `export ${unresolved.join(", ")} before Cursor launches that server.`,
				},
	);

	if (isCloudExposedProject(dir)) {
		results.push({
			status: "fail",
			name: "Cursor MCP cloud enforcement gap",
			detail:
				`${ownedServers.length} mewkit-owned MCP server(s) installed in a project that may run as a Cursor Cloud ` +
				"Agent (a git remote is configured). beforeMCPExecution has no local enforcement equivalent in Cloud " +
				"Agents (docs-confirmed gap) — this is a hard fail, not a note, until Cursor documents cloud-side MCP " +
				"tool gating.",
			fix: "Remove the MCP profile before pushing to a remote the Cloud Agent can run against, or accept the residual risk explicitly (--allow-cloud-mcp was required to install it).",
		});
	}
	void moduleDir; // reserved: a future revision may cross-check against catalog-declared cloud safety per profile.
	return results;
}

/** Reload the profile shape only far enough to extract owned servers' env refs from the live
 *  installed file — not from the catalog, since the installed content is the ground truth for
 *  what's actually on disk (a catalog update after install must not change what doctor reports
 *  for the file as it exists today). */
async function collectUnresolvedEnvRefs(mcpJsonPath: string, ownedServers: string[]): Promise<string[]> {
	let parsed: { mcpServers?: Record<string, unknown> };
	try {
		parsed = JSON.parse(fs.readFileSync(mcpJsonPath, "utf-8"));
	} catch {
		return [];
	}
	const servers = parsed.mcpServers ?? {};
	const ownedOnly: McpProfile["mcpServers"] = {};
	for (const name of ownedServers) {
		const def = servers[name];
		if (def && typeof def === "object") ownedOnly[name] = def as McpProfile["mcpServers"][string];
	}
	const names = new Set<string>();
	for (const n of unresolvedEnvRefs({ description: "", transport: "stdio", mcpServers: ownedOnly })) names.add(n);
	return [...names].sort();
}

/** Full environment-diagnostics pass for a generated Cursor target directory `dir`. */
export async function checkCursorEnvironment(dir: string, moduleDir: string): Promise<DiagResult[]> {
	return [...checkEnvironmentMatrix(moduleDir), ...(await checkMcpProfileHealth(dir, moduleDir))];
}
