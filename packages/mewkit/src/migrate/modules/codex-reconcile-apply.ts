// Reconciler-backed apply for the authored Codex bundle.
//
// Replaces the blind-overwrite copy: init / migrate-overlay / upgrade all reach the
// authored content through THIS one function, which preserves user edits (or surfaces
// an explicit conflict) instead of silently clobbering them, is dry-run-able, and is
// idempotent (a second run writes nothing).
//
// It REUSES — not re-implements — the reconcile primitives: the checksum matrix logic
// mirrors reconciler.ts, reason codes come from reconcile-types, and the ledger rows are
// PortableInstallationV3 (reconcile/portable-registry). The only relocation is storage:
// a PROJECT-LOCAL ledger (.meowkit/state/codex-ledger.json) instead of the home registry.
// This is a new caller of the shared primitives, not a parallel engine.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { computeFileChecksum, computeTreeChecksum } from "../reconcile/checksum-utils.js";
import {
	adoptHomeRegistryCodexRows,
	findCodexLedgerRowByPath,
	readCodexLedger,
	upsertCodexLedgerRow,
	writeCodexLedger,
} from "../reconcile/codex-ledger.js";
import type { PortableInstallationV3 } from "../reconcile/portable-registry.js";
import { getReasonCopy, type ReconcileActionType, type ReconcileReason } from "../reconcile/reconcile-types.js";
import { meowkitStatePaths } from "../../state/meowkit-state-paths.js";
import type { ArtifactManifestEntry } from "./artifact-manifest-schema.js";
import { copyOne, loadCodexBundleManifest, resolveCodexModuleDir } from "./codex-authored-bundle.js";
import {
	expandSkillsEntry,
	isSkillsTreeEntry,
	loadSkillPackCatalog,
	resolvePackSelection,
	type PackSelection,
} from "./codex-skill-packs.js";

/**
 * Expand the aggregate `.agents/skills` entry into one per-skill entry for the selected
 * packs, so the reconciler installs/updates each skill dir independently. When there is
 * no catalog OR no explicit selection, the aggregate entry is kept unchanged (whole-tree
 * install — the pre-pack behavior and the full-bundle verification path).
 */
function expandSkillsForSelection(
	entries: ArtifactManifestEntry[],
	moduleDir: string,
	packs: PackSelection | undefined,
): ArtifactManifestEntry[] {
	if (packs === undefined) return entries;
	const catalog = loadSkillPackCatalog(moduleDir);
	if (!catalog) return entries;
	const { skills } = resolvePackSelection(catalog, packs);
	return entries.flatMap((e) => (isSkillsTreeEntry(e) ? expandSkillsEntry(e, skills) : [e]));
}

export interface AppliedEntry {
	sourcePath: string;
	targetPath: string;
	action: ReconcileActionType;
	reasonCode: ReconcileReason;
	reason: string;
	wrote: boolean;
}

export interface ApplyBundleResult {
	entries: AppliedEntry[];
	writes: number;
	conflicts: AppliedEntry[];
	adopted: number;
	dryRun: boolean;
	ledgerPath: string;
}

export interface ReconcileApplyOptions {
	/** Overlay mode: apply only entries flipped `active` (migrate path). Default false
	 *  (init/upgrade copy the whole committed tree — no converter fallback for inactive
	 *  surfaces, so filtering would install an incomplete toolkit). */
	onlyActive?: boolean;
	/** `--force` / overlay semantics: overwrite user edits + converter output instead of
	 *  preserving/conflicting. */
	force?: boolean;
	/** Plan only — compute + return actions, write nothing (no files, no ledger). */
	dryRun?: boolean;
	/** Records the global flag on ledger rows (global vs project scope). */
	global?: boolean;
	/** Root under which the `.meowkit/` ledger lives. Defaults to `targetDir`. */
	projectRoot?: string;
	/** Adopt matching codex rows from the home registry into the project ledger on first
	 *  run (rollback-safe: home rows are left in place). Default true; skipped on dry-run. */
	adoptHomeRegistry?: boolean;
	/** Skill-pack selection for the `.agents/skills` tree: `"all"`, a pack-name list, or
	 *  `[]` for the catalog default (`core`). Undefined = install the whole skills tree
	 *  unfiltered (pre-pack behavior). Only skills in the selected packs (+ their
	 *  `dependsOn`) install; the reconciler tracks each installed skill dir independently. */
	packs?: PackSelection;
}

interface Decision {
	action: ReconcileActionType;
	reasonCode: ReconcileReason;
	write: boolean;
	recordLedger: boolean;
}

/** Map a manifest entry to a ledger `type`. Cosmetic for identity (rows key on
 *  item+type+provider+global); item is the target path, which is already unique. */
function entryLedgerType(entry: ArtifactManifestEntry): PortableInstallationV3["type"] {
	const t = entry.targetPath;
	if (t.endsWith("skills")) return "skill";
	if (t.endsWith("agents")) return "agent";
	if (t.includes("hooks")) return "hooks";
	return "config";
}

/**
 * The reconcile decision for one entry. Mirrors reconciler.ts:494-624 for the
 * managed-replace case, plus ownership gating and adoption-as-conflict for a target
 * that exists with no ledger baseline (every pre-ledger install).
 */
export function decideCodexEntryAction(input: {
	ownership: ArtifactManifestEntry["ownership"];
	force: boolean;
	srcChecksum: string;
	targetExists: boolean;
	currentTargetChecksum: string | undefined;
	row: PortableInstallationV3 | undefined;
}): Decision {
	const { ownership, force, srcChecksum, targetExists, currentTargetChecksum, row } = input;

	// Ownership gate first. user-owned-never-touch and (unused today) managed-merge are
	// never blind-replaced by this additive apply — preserve, never clobber.
	if (ownership === "user-owned-never-touch" || ownership === "managed-merge") {
		return { action: "skip", reasonCode: "user-edits-preserved", write: false, recordLedger: false };
	}

	// managed-replace.
	if (!row) {
		if (!targetExists) {
			return { action: "install", reasonCode: "new-item", write: true, recordLedger: true };
		}
		// Adoption-as-conflict: a target with no ledger baseline may be user content.
		if (srcChecksum === currentTargetChecksum) {
			// Identical to the authored source → adopt silently, record the baseline.
			return { action: "skip", reasonCode: "target-up-to-date-backfill", write: false, recordLedger: true };
		}
		if (force) {
			return { action: "install", reasonCode: "force-overwrite", write: true, recordLedger: true };
		}
		return { action: "conflict", reasonCode: "both-changed", write: false, recordLedger: false };
	}

	const sourceChanged = srcChecksum !== row.sourceChecksum;

	if (!targetExists) {
		if (sourceChanged) {
			return { action: "install", reasonCode: "target-deleted-source-changed", write: true, recordLedger: true };
		}
		if (force) {
			return { action: "install", reasonCode: "force-reinstall", write: true, recordLedger: true };
		}
		return { action: "skip", reasonCode: "user-deleted-respected", write: false, recordLedger: false };
	}

	const targetChanged = currentTargetChecksum !== row.targetChecksum;

	if (!sourceChanged && !targetChanged) {
		return { action: "skip", reasonCode: "no-changes", write: false, recordLedger: false };
	}
	if (sourceChanged && !targetChanged) {
		return { action: "update", reasonCode: "source-changed", write: true, recordLedger: true };
	}
	if (!sourceChanged && targetChanged) {
		if (force) return { action: "install", reasonCode: "force-overwrite", write: true, recordLedger: true };
		return { action: "skip", reasonCode: "user-edits-preserved", write: false, recordLedger: false };
	}
	// Both changed.
	if (force) return { action: "install", reasonCode: "force-overwrite", write: true, recordLedger: true };
	return { action: "conflict", reasonCode: "both-changed", write: false, recordLedger: false };
}

function makeLedgerRow(
	entry: ArtifactManifestEntry,
	targetAbsPath: string,
	global: boolean,
	srcChecksum: string,
): PortableInstallationV3 {
	// After a write (or an adopt of an identical target), target content == source, so
	// both checksums are the source checksum.
	return {
		item: entry.targetPath,
		type: entryLedgerType(entry),
		provider: "codex",
		global,
		path: targetAbsPath,
		installedAt: new Date().toISOString(),
		sourcePath: entry.sourcePath,
		sourceChecksum: srcChecksum,
		targetChecksum: srcChecksum,
		installSource: "kit",
	};
}

/**
 * Apply the authored Codex bundle from `moduleDir` into `targetDir`, reconciling each
 * manifest entry against the project-local ledger. init / migrate-overlay / upgrade all
 * route here.
 */
export async function reconcileApplyCodexBundle(
	moduleDir: string,
	targetDir: string,
	opts: ReconcileApplyOptions = {},
): Promise<ApplyBundleResult> {
	const projectRoot = opts.projectRoot ?? targetDir;
	const ledgerPath = meowkitStatePaths(join(projectRoot, ".meowkit")).codexLedger;

	const adopted =
		(opts.adoptHomeRegistry ?? true) && !opts.dryRun ? await adoptHomeRegistryCodexRows(ledgerPath, projectRoot) : 0;

	const ledger = await readCodexLedger(ledgerPath);
	const manifest = loadCodexBundleManifest(moduleDir);
	const activeEntries = opts.onlyActive ? manifest.entries.filter((e) => e.active) : manifest.entries;
	const entries = expandSkillsForSelection(activeEntries, moduleDir, opts.packs);

	const results: AppliedEntry[] = [];
	let ledgerDirty = false;

	for (const entry of entries) {
		const srcAbs = join(moduleDir, entry.sourcePath);
		if (!existsSync(srcAbs)) throw new Error(`authored codex artifact missing: ${entry.sourcePath}`);
		const isDir = statSync(srcAbs).isDirectory();
		const tgtAbs = join(targetDir, entry.targetPath);

		const srcChecksum = isDir ? await computeTreeChecksum(srcAbs) : await computeFileChecksum(srcAbs);
		const targetExists = existsSync(tgtAbs);
		const currentTargetChecksum = targetExists
			? isDir
				? await computeTreeChecksum(tgtAbs)
				: await computeFileChecksum(tgtAbs)
			: undefined;

		const row = findCodexLedgerRowByPath(ledger, tgtAbs);
		const decision = decideCodexEntryAction({
			ownership: entry.ownership,
			force: !!opts.force,
			srcChecksum,
			targetExists,
			currentTargetChecksum,
			row,
		});

		let wrote = false;
		if (decision.write && !opts.dryRun) {
			copyOne(moduleDir, targetDir, entry);
			wrote = true;
		}
		if (decision.recordLedger && !opts.dryRun) {
			upsertCodexLedgerRow(ledger, makeLedgerRow(entry, tgtAbs, !!opts.global, srcChecksum));
			ledgerDirty = true;
		}

		results.push({
			sourcePath: entry.sourcePath,
			targetPath: entry.targetPath,
			action: decision.action,
			reasonCode: decision.reasonCode,
			reason: getReasonCopy(decision.reasonCode),
			wrote,
		});
	}

	if (ledgerDirty && !opts.dryRun) await writeCodexLedger(ledgerPath, ledger);

	return {
		entries: results,
		writes: results.filter((r) => r.wrote).length,
		conflicts: results.filter((r) => r.action === "conflict"),
		adopted,
		dryRun: !!opts.dryRun,
		ledgerPath,
	};
}

/** Convenience: apply the installed bundle (migrate overlay — active entries only,
 *  overwrite converter output). Returns the reconcile result. */
export async function applyActiveCodexOverlay(
	targetDir: string,
	opts: { global?: boolean; moduleDir?: string } = {},
): Promise<ApplyBundleResult> {
	const moduleDir = opts.moduleDir ?? resolveCodexModuleDir();
	if (!existsSync(join(moduleDir, "manifest.json"))) {
		return { entries: [], writes: 0, conflicts: [], adopted: 0, dryRun: false, ledgerPath: "" };
	}
	// Overlay overwrites machine-generated converter output (not user edits), so force.
	return reconcileApplyCodexBundle(moduleDir, targetDir, {
		onlyActive: true,
		force: true,
		global: opts.global,
		projectRoot: targetDir,
	});
}
