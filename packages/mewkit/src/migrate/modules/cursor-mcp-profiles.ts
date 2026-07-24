// Secret-safe merge-not-replace application of the authored Cursor bundle's MCP profiles.
// Fresh install ships ZERO MCP config — a profile only takes effect when explicitly selected
// (`init --target cursor --mcp-profiles <name>` or the interactive prompt). This is
// deliberately NOT folded into the manifest-driven reconciler (cursor-reconcile-apply.ts):
// that engine reconciles whole FILE-TREE entries end-to-end, but `.cursor/mcp.json` needs a
// KEY-LEVEL merge into a file the user may already own entirely — user server keys must
// always win, conflicts are reported, nothing is ever silently overwritten. It DOES reuse the
// existing `ownedSections` ledger primitive (portable-registry.ts) — the same mechanism the
// legacy config-merger uses to track which slice of a shared file mewkit owns — rather than
// inventing a parallel bookkeeping shape, and reuses cursor-ledger.ts + checksum-utils for
// storage. Promote this into a larger dedicated resolver only if 2-3 real profiles demonstrate
// a genuinely different merge pattern than the one below.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { computeContentChecksum } from "../reconcile/checksum-utils.js";
import {
	findCursorLedgerRowByPath,
	readCursorLedger,
	upsertCursorLedgerRow,
	writeCursorLedger,
} from "../reconcile/cursor-ledger.js";
import { meowkitStatePaths } from "../../state/meowkit-state-paths.js";
import { loadMcpProfileCatalog, resolveMcpProfiles, type McpProfileSelection } from "./cursor-mcp-profile-catalog.js";
import { lintMcpProfileForSecrets } from "./cursor-mcp-profile-lint.js";

export type { McpProfile, McpProfileSelection } from "./cursor-mcp-profile-catalog.js";
export { loadMcpProfileCatalog, resolveMcpProfiles } from "./cursor-mcp-profile-catalog.js";
export { lintMcpProfileForSecrets, unresolvedEnvRefs, DOCUMENTED_STATIC_INTERPOLATION_VARS } from "./cursor-mcp-profile-lint.js";

/** A project "may run as a Cloud Agent" when it has at least one git remote configured —
 *  Cursor Cloud Agents operate against a remote-hosted repo, so a remoteless local-only
 *  project cannot be handed to Cloud today. Best-effort: no git / no remote ⇒ not exposed. */
export function isCloudExposedProject(dir: string): boolean {
	try {
		const out = execSync("git remote", { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
		return out.length > 0;
	} catch {
		return false;
	}
}

async function atomicWriteJson(targetPath: string, content: unknown): Promise<void> {
	const dir = dirname(targetPath);
	mkdirSync(dir, { recursive: true });
	const tmp = join(dir, `.mewkit-tmp-mcp-${process.pid}-${Date.now()}`);
	try {
		await writeFile(tmp, `${JSON.stringify(content, null, 2)}\n`, "utf-8");
		await rename(tmp, targetPath);
	} catch (error) {
		try {
			await unlink(tmp);
		} catch {
			/* best-effort */
		}
		throw error;
	}
}

export interface McpApplyResult {
	/** False when there was nothing to do (empty selection) or the cloud gate blocked it. */
	applied: boolean;
	blockedByCloudGate: boolean;
	mcpJsonPath: string;
	addedServers: string[];
	/** Server names already present with DIFFERENT content — never overwritten. */
	conflictServers: string[];
}

/**
 * Merge the selected profiles' `mcpServers` into the target project's `.cursor/mcp.json`.
 * Deny-by-default: an empty selection is a pure no-op (file untouched, nothing recorded).
 * Cloud gate: a cloud-exposed project (see `isCloudExposedProject`) requires `allowCloudMcp`
 * — `beforeMCPExecution` has no cloud enforcement equivalent (docs-confirmed gap), so applying
 * MCP there is a second, explicit opt-in. User server keys always win on a name collision
 * (reported as `conflictServers`, never overwritten); an identical already-present entry is a
 * silent no-op re-apply. The selection is recorded in the project cursor ledger via the
 * existing `ownedSections` field so doctor and re-applies know which server keys mewkit owns.
 */
export async function applyMcpProfiles(
	moduleDir: string,
	targetDir: string,
	selection: McpProfileSelection,
	opts: { allowCloudMcp?: boolean; projectRoot?: string } = {},
): Promise<McpApplyResult> {
	const mcpJsonPath = join(targetDir, ".cursor", "mcp.json");
	const emptySelection = selection !== "all" && selection.length === 0;
	if (emptySelection) {
		return { applied: false, blockedByCloudGate: false, mcpJsonPath, addedServers: [], conflictServers: [] };
	}

	const catalog = loadMcpProfileCatalog(moduleDir);
	if (!catalog) throw new Error("no mcp-profiles.json catalog shipped in this bundle");
	const resolved = resolveMcpProfiles(catalog, selection);

	const lintIssues = resolved.flatMap(({ name, profile }) => lintMcpProfileForSecrets(name, profile));
	if (lintIssues.length > 0) {
		throw new Error(`refusing to apply MCP profile(s) — secret-safety lint failed:\n${lintIssues.join("\n")}`);
	}

	if (isCloudExposedProject(targetDir) && !opts.allowCloudMcp) {
		return { applied: false, blockedByCloudGate: true, mcpJsonPath, addedServers: [], conflictServers: [] };
	}

	const existing: { mcpServers?: Record<string, unknown>; [k: string]: unknown } = existsSync(mcpJsonPath)
		? JSON.parse(readFileSync(mcpJsonPath, "utf-8"))
		: {};
	const existingServers = existing.mcpServers && typeof existing.mcpServers === "object" ? existing.mcpServers : {};

	const merged = { ...existingServers };
	const addedServers: string[] = [];
	const conflictServers: string[] = [];
	for (const { profile } of resolved) {
		for (const [serverName, def] of Object.entries(profile.mcpServers)) {
			if (!(serverName in existingServers)) {
				merged[serverName] = def;
				addedServers.push(serverName);
			} else if (JSON.stringify(existingServers[serverName]) !== JSON.stringify(def)) {
				conflictServers.push(serverName);
			}
			// Identical already-present entry: silent no-op (idempotent re-apply).
		}
	}

	await atomicWriteJson(mcpJsonPath, { ...existing, mcpServers: merged });

	const projectRoot = opts.projectRoot ?? targetDir;
	const ledgerPath = meowkitStatePaths(join(projectRoot, ".meowkit")).cursorLedger;
	const ledger = await readCursorLedger(ledgerPath);
	const existingRow = findCursorLedgerRowByPath(ledger, mcpJsonPath);
	const ownedSections = [...new Set([...(existingRow?.ownedSections ?? []), ...addedServers])].sort();
	const contentChecksum = computeContentChecksum(JSON.stringify(resolved.map((r) => r.profile)));
	upsertCursorLedgerRow(ledger, {
		item: ".cursor/mcp.json",
		type: "config",
		provider: "cursor",
		global: false,
		path: mcpJsonPath,
		installedAt: existingRow?.installedAt ?? new Date().toISOString(),
		sourcePath: `catalog/mcp-profiles.json#${resolved.map((r) => r.name).join(",")}`,
		sourceChecksum: contentChecksum,
		targetChecksum: contentChecksum,
		installSource: "kit",
		ownedSections,
	});
	await writeCursorLedger(ledgerPath, ledger);

	return { applied: true, blockedByCloudGate: false, mcpJsonPath, addedServers, conflictServers };
}
