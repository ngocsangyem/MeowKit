// Per-store lock granularity that composes UNDER the single project/migration lock
// (`migrate/reconcile/process-lock.ts`, lockfile `.meowkit/state/migrate.lock`).
//
// Lock layering contract (fixed nesting order): project lock → store lock.
//   - The migration transaction holds the OUTER project lock for the whole run.
//   - A normal (non-migration) structured write acquires only the INNER per-store
//     lock, but first waits out any active migration so it never races the
//     canonical-store publish. When the writer IS the migration (it already holds
//     the project lock), it passes `underMigration` to skip that wait — the nested,
//     allowed case.
// This module introduces NO new project-scope lock primitive; it reuses the
// existing `core/file-lock.ts` sidecar protocol for the per-store lock.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withFileLock } from "../core/file-lock.js";
import { meowkitStatePaths } from "./meowkit-state-paths.js";

const DEFAULT_MIGRATION_WAIT_MS = 10 * 1000;
const MIGRATION_POLL_MS = 100;

export interface MigrationWaitOptions {
	migrationWaitMs?: number;
}

/** Path of the per-store lockfile under `.meowkit/state/locks/`. */
export function storeLockPath(meowkitRoot: string, store: string): string {
	return join(meowkitStatePaths(meowkitRoot).storeLocksDir, `${store}.lock`);
}

function pidIsAlive(pid: number): boolean {
	if (!Number.isFinite(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/** True when `.meowkit/state/migrate.lock` exists and its owner PID is a live
 *  process (an active migration). A stale lock (dead PID) reads as inactive. */
export function isMigrationLockActive(meowkitRoot: string): boolean {
	const lockPath = meowkitStatePaths(meowkitRoot).migrateLock;
	if (!existsSync(lockPath)) return false;
	try {
		const pid = Number.parseInt(readFileSync(lockPath, "utf-8").trim().split("\n")[0] ?? "", 10);
		return pidIsAlive(pid);
	} catch {
		return false;
	}
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Block until no migration lock is active, or throw once the bounded wait elapses.
 *  A caller that IS the migration must NOT call this (it holds the lock itself). */
export async function waitForNoActiveMigration(meowkitRoot: string, opts: MigrationWaitOptions = {}): Promise<void> {
	const budget = opts.migrationWaitMs ?? DEFAULT_MIGRATION_WAIT_MS;
	const deadline = Date.now() + budget;
	while (isMigrationLockActive(meowkitRoot)) {
		if (Date.now() >= deadline) {
			throw new Error(`store write blocked: a migration lock is active on ${meowkitRoot} (waited ${budget}ms)`);
		}
		await sleep(MIGRATION_POLL_MS);
	}
}

export interface StoreLockOptions extends MigrationWaitOptions {
	/** Set by the migration transaction (it already holds the project lock) to skip
	 *  the migration wait — the nested project-lock → store-lock case. */
	underMigration?: boolean;
}

/** Run `fn` while holding the per-store lock, after ensuring no foreign migration
 *  is active (unless `underMigration`). Enforces the project→store nesting order. */
export async function withStoreLock<T>(
	meowkitRoot: string,
	store: string,
	fn: () => Promise<T>,
	opts: StoreLockOptions = {},
): Promise<T> {
	if (!opts.underMigration) await waitForNoActiveMigration(meowkitRoot, opts);
	const lockPath = storeLockPath(meowkitRoot, store);
	mkdirSync(meowkitStatePaths(meowkitRoot).storeLocksDir, { recursive: true });
	return withFileLock(lockPath, fn);
}
