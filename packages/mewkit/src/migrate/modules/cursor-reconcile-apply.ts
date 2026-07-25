// Reconciler-backed apply for the authored Cursor bundle.
//
// Additive twin of codex-reconcile-apply.ts (duplicate-first: the codex module is never
// renamed or parametrized). The reconcile DECISION matrix is provider-agnostic — it only
// reasons about ownership/force/checksums/ledger-row shape, never a provider string — so this
// file imports `decideCodexEntryAction` from the codex module UNCHANGED instead of re-deriving
// it. Only the trivially provider-specific ledger-row constructor is duplicated below.
//
// Storage: a PROJECT-LOCAL ledger (`.meowkit/state/cursor-ledger.json`), same shape and
// reasoning as the Codex ledger (reconcile/cursor-ledger.ts is itself a thin twin of
// reconcile/codex-ledger.ts).
//
// Atomic-write hardening: each entry is staged via temp+rename in the SAME target directory
// (`copyOneAtomic` in cursor-authored-bundle.ts) and its ledger row is flushed to disk
// IMMEDIATELY after that entry writes — not once at the end of the loop. A crash between two
// entries therefore leaves the ledger consistent with everything written so far: the next run
// only re-derives a decision for the entry that was interrupted (or the ones after it), never a
// permanent false conflict for entries that already completed cleanly.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { computeFileChecksum, computeTreeChecksum } from "../reconcile/checksum-utils.js";
import {
	adoptHomeRegistryCursorRows,
	findCursorLedgerRowByPath,
	readCursorLedger,
	upsertCursorLedgerRow,
	writeCursorLedger,
} from "../reconcile/cursor-ledger.js";
import type { PortableInstallationV3 } from "../reconcile/portable-registry.js";
import { getReasonCopy, type ReconcileActionType, type ReconcileReason } from "../reconcile/reconcile-types.js";
import { meowkitStatePaths } from "../../state/meowkit-state-paths.js";
import type { ArtifactManifestEntry } from "./artifact-manifest-schema.js";
import { copyOneAtomic, loadCursorBundleManifest } from "./cursor-authored-bundle.js";
import { decideCodexEntryAction } from "./codex-reconcile-apply.js";
import {
	expandSkillsEntry,
	isSkillsTreeEntry,
	loadSkillPackCatalog,
	resolvePackSelection,
	type PackSelection,
} from "./codex-skill-packs.js";

/**
 * Expand the aggregate `.agents/skills` entry into one per-skill entry for the selected
 * packs, so the reconciler installs/updates each skill dir independently. Mirrors
 * `expandSkillsForSelection` in codex-reconcile-apply.ts — the pack-resolution primitives
 * are provider-agnostic (they only reason about a manifest entry's target path and a
 * catalog's pack/skill mapping), so this reuses them against the cursor moduleDir instead
 * of re-deriving the logic. When there is no catalog OR no explicit selection, the
 * aggregate entry is kept unchanged (whole-tree install — the pre-pack behavior).
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
	/** Overlay mode: apply only entries flipped `active`. Default false — init/upgrade copy the
	 *  whole committed tree (no legacy-converter fallback for inactive surfaces). */
	onlyActive?: boolean;
	/** `--force` semantics: overwrite user edits instead of preserving/conflicting. */
	force?: boolean;
	/** Plan only — compute + return actions, write nothing (no files, no ledger). */
	dryRun?: boolean;
	/** Records the global flag on ledger rows (global vs project scope). */
	global?: boolean;
	/** Root under which the `.meowkit/` ledger lives. Defaults to `targetDir`. */
	projectRoot?: string;
	/** Adopt matching cursor rows from the home registry into the project ledger on first run
	 *  (rollback-safe: home rows are left in place). Default true; skipped on dry-run. */
	adoptHomeRegistry?: boolean;
	/** Skill-pack selection for the `.agents/skills` tree: `"all"`, a pack-name list, or
	 *  `[]` for the catalog default (`core`). Undefined = install the whole skills tree
	 *  unfiltered (pre-pack behavior). Only skills in the selected packs (+ their
	 *  `dependsOn`) install; the reconciler tracks each installed skill dir independently. */
	packs?: PackSelection;
}

/** Map a manifest entry to a ledger `type`. Cosmetic for identity (rows key on
 *  item+type+provider+global); item is the target path, which is already unique. Mirrors
 *  `entryLedgerType` in codex-reconcile-apply.ts (not exported there, so duplicated here). */
function entryLedgerType(entry: ArtifactManifestEntry): PortableInstallationV3["type"] {
	const t = entry.targetPath;
	if (t.endsWith("skills")) return "skill";
	if (t.endsWith("agents")) return "agent";
	if (t.includes("hooks")) return "hooks";
	return "config";
}

/** Build the cursor ledger row for one applied entry. The ~10-line duplicate the plan calls
 *  out: everything else in this file reuses the shared decision matrix and ledger primitives. */
function makeCursorLedgerRow(
	entry: ArtifactManifestEntry,
	targetAbsPath: string,
	global: boolean,
	srcChecksum: string,
	existingRow?: PortableInstallationV3,
): PortableInstallationV3 {
	// Preserve the original install time when the source is unchanged (an idempotent
	// force re-affirm) so a no-content-change re-run stays byte-identical; only a genuine
	// source change re-stamps the timestamp. Mirrors codex-reconcile-apply.ts's makeLedgerRow.
	const installedAt =
		existingRow && existingRow.sourceChecksum === srcChecksum ? existingRow.installedAt : new Date().toISOString();
	return {
		item: entry.targetPath,
		type: entryLedgerType(entry),
		provider: "cursor",
		global,
		path: targetAbsPath,
		installedAt,
		sourcePath: entry.sourcePath,
		sourceChecksum: srcChecksum,
		targetChecksum: srcChecksum,
		installSource: "kit",
	};
}

/**
 * Apply the authored Cursor bundle from `moduleDir` into `targetDir`, reconciling each
 * manifest entry against the project-local cursor ledger. init / upgrade both route here.
 */
export async function reconcileApplyCursorBundle(
	moduleDir: string,
	targetDir: string,
	opts: ReconcileApplyOptions = {},
): Promise<ApplyBundleResult> {
	const projectRoot = opts.projectRoot ?? targetDir;
	const ledgerPath = meowkitStatePaths(join(projectRoot, ".meowkit")).cursorLedger;

	const adopted =
		(opts.adoptHomeRegistry ?? true) && !opts.dryRun ? await adoptHomeRegistryCursorRows(ledgerPath, projectRoot) : 0;

	const ledger = await readCursorLedger(ledgerPath);
	const manifest = loadCursorBundleManifest(moduleDir);
	const activeEntries = opts.onlyActive ? manifest.entries.filter((e) => e.active) : manifest.entries;
	const entries = expandSkillsForSelection(activeEntries, moduleDir, opts.packs);

	const results: AppliedEntry[] = [];

	for (const entry of entries) {
		const srcAbs = join(moduleDir, entry.sourcePath);
		if (!existsSync(srcAbs)) throw new Error(`authored cursor artifact missing: ${entry.sourcePath}`);
		const isDir = statSync(srcAbs).isDirectory();
		const tgtAbs = join(targetDir, entry.targetPath);

		const srcChecksum = isDir ? await computeTreeChecksum(srcAbs) : await computeFileChecksum(srcAbs);
		const targetExists = existsSync(tgtAbs);
		const currentTargetChecksum = targetExists
			? isDir
				? await computeTreeChecksum(tgtAbs)
				: await computeFileChecksum(tgtAbs)
			: undefined;

		const row = findCursorLedgerRowByPath(ledger, tgtAbs);
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
			copyOneAtomic(moduleDir, targetDir, entry);
			wrote = true;
		}
		// Per-entry ledger flush (see file header): a crash after this write but before the
		// next entry starts leaves the ledger already consistent with this entry's result.
		if (decision.recordLedger && !opts.dryRun) {
			upsertCursorLedgerRow(ledger, makeCursorLedgerRow(entry, tgtAbs, !!opts.global, srcChecksum, row));
			await writeCursorLedger(ledgerPath, ledger);
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

	return {
		entries: results,
		writes: results.filter((r) => r.wrote).length,
		conflicts: results.filter((r) => r.action === "conflict"),
		adopted,
		dryRun: !!opts.dryRun,
		ledgerPath,
	};
}
