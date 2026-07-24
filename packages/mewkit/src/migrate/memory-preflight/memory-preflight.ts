// Memory preflight entrypoint: discover legacy `.claude/memory/`, build a validated
// inventory + reconciliation plan against the existing `.meowkit/` root, and return
// the plan (inventory, staging actions, conflicts, and a `noop` fast-path signal).
// Pure planning — zero filesystem mutation. The transaction that executes this plan
// is phase 3.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { discoverLegacyMemory } from "./legacy-memory-discovery.js";
import { buildEntry } from "./memory-inventory.js";
import type { InventoryEntry, PreflightOptions, PreflightResult } from "./preflight-types.js";

const LEGACY_MEMORY_REL = join(".claude", "memory");

/** Plan the legacy → `.meowkit/` memory migration for a project. Read-only. */
export async function runMemoryPreflight(projectRoot: string, opts: PreflightOptions = {}): Promise<PreflightResult> {
	const legacyRoot = join(projectRoot, LEGACY_MEMORY_REL);
	const meowkitRoot = opts.meowkitRoot ?? join(projectRoot, ".meowkit");

	const inventory: InventoryEntry[] = [];
	if (existsSync(legacyRoot)) {
		const discovered = discoverLegacyMemory(legacyRoot);
		for (const file of discovered) inventory.push(await buildEntry(file, meowkitRoot));
	}

	// Deterministic ordering so reports and snapshot tests are stable.
	inventory.sort((a, b) => a.relPath.localeCompare(b.relPath));

	const actions = inventory.filter((e) => e.action === "stage" || e.action === "quarantine");
	const conflicts = inventory.filter((e) => e.action === "conflict");
	const noop = actions.length === 0 && conflicts.length === 0;

	return { legacyRoot, meowkitRoot, inventory, actions, conflicts, noop };
}
