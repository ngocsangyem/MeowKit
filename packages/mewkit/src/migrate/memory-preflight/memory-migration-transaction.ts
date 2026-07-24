// Execute a memory-migration plan as a locked, staged, checksummed, atomic
// transaction. Order: stage every action into `.meowkit/migrations/<run-id>/staging/`
// → publish each staged file to its canonical target (per-file temp+rename) →
// archive the original legacy file into the run's `legacy-archive/`. The manifest is
// rewritten after every publish so an interruption is recoverable. Fencing runs
// twice (at stage, and again immediately before each archive move) so a concurrent
// legacy writer is never silently swept into the archive. Conflicts abort before any
// publish; `--force` never applies to this user-owned memory data.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import * as fsp from "node:fs/promises";
import { dirname, join } from "node:path";
import { acquireMigrationLock, releaseMigrationLock } from "../reconcile/process-lock.js";
import { meowkitStatePaths } from "../../state/meowkit-state-paths.js";
import { sha256File } from "./memory-inventory.js";
import { readManifest, writeManifest, type ManifestEntry, type MigrationManifest } from "./migration-manifest.js";
import type { InventoryEntry, PreflightResult } from "./preflight-types.js";

export interface MigrationHooks {
	afterStageAll?(): void | Promise<void>;
	beforePublish?(entry: ManifestEntry, index: number): void | Promise<void>;
	afterPublish?(entry: ManifestEntry, index: number): void | Promise<void>;
	beforeArchive?(entry: ManifestEntry, index: number): void | Promise<void>;
}

export interface MigrationTransactionOptions {
	projectRoot?: string;
	runId?: string;
	now?: string;
	/** Present for API symmetry; force never applies to user memory data. */
	force?: boolean;
	hooks?: MigrationHooks;
}

export interface MigrationTransactionResult {
	status: "noop" | "complete" | "aborted" | "blocked";
	runId: string | null;
	published: number;
	quarantined: number;
	/** Entries left live in legacy because their source changed mid-run (fenced). */
	fenced: ManifestEntry[];
	conflicts: InventoryEntry[];
	reason?: string;
	heldBy?: number;
}

function makeRunId(now: string): string {
	const compact = now.replace(/[^0-9]/g, "").slice(0, 14);
	const suffix = createHash("sha1")
		.update(now + String(process.hrtime.bigint()))
		.digest("hex")
		.slice(0, 6);
	return `${compact}-${suffix}`;
}

/** Binary-safe atomic publish: copy staged file to a sibling temp, then rename. */
async function atomicPublish(stagePath: string, targetPath: string): Promise<void> {
	await fsp.mkdir(dirname(targetPath), { recursive: true });
	const tmp = `${targetPath}.tmp.${process.pid}.${createHash("sha1").update(stagePath).digest("hex").slice(0, 8)}`;
	await fsp.copyFile(stagePath, tmp);
	try {
		await fsp.rename(tmp, targetPath);
	} catch (err) {
		await fsp.rm(tmp, { force: true });
		throw err;
	}
}

async function moveFile(src: string, dest: string): Promise<void> {
	await fsp.mkdir(dirname(dest), { recursive: true });
	try {
		await fsp.rename(src, dest);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "EXDEV") throw err;
		await fsp.copyFile(src, dest);
		await fsp.rm(src, { force: true });
	}
}

interface RunPaths {
	runDir: string;
	staging: string;
	archive: string;
	manifestPath: string;
}

function runPaths(meowkitRoot: string, runId: string): RunPaths {
	const runDir = join(meowkitStatePaths(meowkitRoot).migrations, runId);
	return {
		runDir,
		staging: join(runDir, "staging"),
		archive: join(runDir, "legacy-archive"),
		manifestPath: join(runDir, "manifest.json"),
	};
}

/** Stage phase: fence + copy each action source into staging. */
async function stageAll(plan: PreflightResult, paths: RunPaths, manifest: MigrationManifest): Promise<void> {
	for (const entry of plan.actions) {
		const me: ManifestEntry = {
			relPath: entry.relPath,
			sourcePath: entry.sourcePath,
			targetClass: entry.targetClass,
			targetRelPath: entry.targetRelPath,
			checksum: entry.checksum ?? "",
			action: entry.action,
			outcome: "staged",
		};
		const current = await sha256File(entry.sourcePath).catch(() => null);
		if (current !== entry.checksum) {
			me.outcome = "aborted";
			me.note = "source changed before staging — left live in legacy";
			manifest.entries.push(me);
			continue;
		}
		const stagePath = join(paths.staging, entry.targetRelPath);
		await fsp.mkdir(dirname(stagePath), { recursive: true });
		await fsp.copyFile(entry.sourcePath, stagePath);
		manifest.entries.push(me);
	}
}

/** Publish phase: atomically publish every staged entry; manifest re-written each time. */
async function publishAll(
	paths: RunPaths,
	meowkitRoot: string,
	manifest: MigrationManifest,
	hooks?: MigrationHooks,
): Promise<void> {
	for (let i = 0; i < manifest.entries.length; i++) {
		const me = manifest.entries[i];
		if (me.outcome !== "staged") continue;
		await hooks?.beforePublish?.(me, i);
		await atomicPublish(join(paths.staging, me.targetRelPath), join(meowkitRoot, me.targetRelPath));
		me.outcome = me.action === "quarantine" ? "quarantined" : "published";
		await writeManifest(paths.manifestPath, manifest);
		await hooks?.afterPublish?.(me, i);
	}
}

/** Archive phase: fence-verify each source, then move it into the run archive. */
async function archiveAll(paths: RunPaths, manifest: MigrationManifest, hooks?: MigrationHooks): Promise<void> {
	for (let i = 0; i < manifest.entries.length; i++) {
		const me = manifest.entries[i];
		if (me.outcome !== "published" && me.outcome !== "quarantined") continue;
		if (me.archived) continue;
		await hooks?.beforeArchive?.(me, i);
		const current = await sha256File(me.sourcePath).catch(() => null);
		if (current !== me.checksum) {
			me.archived = false;
			me.note = "source changed during migration — left live in legacy";
			await writeManifest(paths.manifestPath, manifest);
			continue;
		}
		await moveFile(me.sourcePath, join(paths.archive, me.relPath));
		me.archived = true;
		await writeManifest(paths.manifestPath, manifest);
	}
}

/** Prune the `staging/` subdir of runs older than the newest `keep`; manifests and
 *  legacy-archives are retained (archive removal requires explicit user confirmation). */
export async function pruneRunDirs(meowkitRoot: string, keep = 3): Promise<void> {
	const migrations = meowkitStatePaths(meowkitRoot).migrations;
	if (!existsSync(migrations)) return;
	const dirs = (await fsp.readdir(migrations, { withFileTypes: true }))
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort()
		.reverse();
	for (const name of dirs.slice(keep)) {
		await fsp.rm(join(migrations, name, "staging"), { recursive: true, force: true });
	}
}

async function finalize(
	paths: RunPaths,
	manifest: MigrationManifest,
	meowkitRoot: string,
): Promise<MigrationTransactionResult> {
	manifest.status = "complete";
	await writeManifest(paths.manifestPath, manifest);
	await pruneRunDirs(meowkitRoot);
	return {
		status: "complete",
		runId: manifest.runId,
		published: manifest.entries.filter((e) => e.outcome === "published").length,
		quarantined: manifest.entries.filter((e) => e.outcome === "quarantined").length,
		fenced: manifest.entries.filter((e) => e.outcome === "aborted" || e.archived === false),
		conflicts: [],
	};
}

/** Execute a preflight plan as a transaction. Conflicts abort before publish; the
 *  noop plan does nothing (no lock, no run-dir). */
export async function runMemoryMigrationTransaction(
	plan: PreflightResult,
	opts: MigrationTransactionOptions = {},
): Promise<MigrationTransactionResult> {
	if (plan.noop) return { status: "noop", runId: null, published: 0, quarantined: 0, fenced: [], conflicts: [] };
	if (plan.conflicts.length > 0)
		return {
			status: "aborted",
			reason: "conflicts",
			runId: null,
			published: 0,
			quarantined: 0,
			fenced: [],
			conflicts: plan.conflicts,
		};

	const projectRoot = opts.projectRoot ?? dirname(plan.meowkitRoot);
	const lock = await acquireMigrationLock({ scope: "project", projectRoot });
	if (!lock.acquired)
		return {
			status: "blocked",
			runId: null,
			published: 0,
			quarantined: 0,
			fenced: [],
			conflicts: [],
			heldBy: lock.heldBy,
		};

	try {
		const now = opts.now ?? new Date().toISOString();
		const runId = opts.runId ?? makeRunId(now);
		const paths = runPaths(plan.meowkitRoot, runId);
		const manifest: MigrationManifest = {
			runId,
			createdAt: now,
			legacyRoot: plan.legacyRoot,
			meowkitRoot: plan.meowkitRoot,
			status: "in-progress",
			entries: [],
		};

		await stageAll(plan, paths, manifest);
		await writeManifest(paths.manifestPath, manifest);
		await opts.hooks?.afterStageAll?.();

		await publishAll(paths, plan.meowkitRoot, manifest, opts.hooks);
		await archiveAll(paths, manifest, opts.hooks);
		return await finalize(paths, manifest, plan.meowkitRoot);
	} finally {
		await releaseMigrationLock(lock.lockPath);
	}
}

/** Resume the single in-progress run under `meowkitRoot`, or abort if its manifest is
 *  unreadable/torn (legacy stays authoritative — no partial resume). */
export async function recoverMemoryMigration(
	meowkitRoot: string,
	opts: { projectRoot?: string; hooks?: MigrationHooks } = {},
): Promise<MigrationTransactionResult> {
	const migrations = meowkitStatePaths(meowkitRoot).migrations;
	if (!existsSync(migrations))
		return { status: "noop", runId: null, published: 0, quarantined: 0, fenced: [], conflicts: [] };

	const runDirs = (await fsp.readdir(migrations, { withFileTypes: true }))
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort()
		.reverse();

	for (const runId of runDirs) {
		const paths = runPaths(meowkitRoot, runId);
		if (!existsSync(paths.manifestPath)) continue;
		const manifest = await readManifest(paths.manifestPath);
		if (!manifest) {
			// Torn/unparsable manifest — fail closed. Legacy remains authoritative.
			return {
				status: "aborted",
				reason: "corrupt-manifest",
				runId,
				published: 0,
				quarantined: 0,
				fenced: [],
				conflicts: [],
			};
		}
		if (manifest.status !== "in-progress") continue;

		const projectRoot = opts.projectRoot ?? dirname(meowkitRoot);
		const lock = await acquireMigrationLock({ scope: "project", projectRoot });
		if (!lock.acquired)
			return { status: "blocked", runId, published: 0, quarantined: 0, fenced: [], conflicts: [], heldBy: lock.heldBy };
		try {
			await publishAll(paths, meowkitRoot, manifest, opts.hooks);
			await archiveAll(paths, manifest, opts.hooks);
			return await finalize(paths, manifest, meowkitRoot);
		} finally {
			await releaseMigrationLock(lock.lockPath);
		}
	}
	return { status: "noop", runId: null, published: 0, quarantined: 0, fenced: [], conflicts: [] };
}
