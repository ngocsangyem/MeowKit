/**
 * Single-editor advisory lock (red-team L1).
 *
 * `edit` writes a lockfile (pid + port) into the plan dir; a second `edit` on the
 * same dir warns and refuses unless `--force`. A lock whose pid is no longer alive
 * is treated as stale and reclaimed. This is advisory UX only — the Phase-5
 * ETag/409 path remains the correctness backstop against concurrent writes.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const LOCK_FILE = ".visual-plan-lock";

export interface LockInfo {
	pid: number;
	port: number;
	startedAt: string;
}

/** True when a process with `pid` is currently alive. */
function pidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0); // signal 0 = existence check, no signal sent
		return true;
	} catch (e) {
		// EPERM means the process EXISTS but is owned by another user (still alive);
		// only ESRCH (no such process) means the pid is dead and the lock is stale.
		return (e as NodeJS.ErrnoException).code === "EPERM";
	}
}

/** Read the current lock, or null when absent/unparseable. */
export function readEditLock(planDir: string): LockInfo | null {
	try {
		const parsed = JSON.parse(fs.readFileSync(path.join(planDir, LOCK_FILE), "utf-8")) as LockInfo;
		return typeof parsed.pid === "number" ? parsed : null;
	} catch {
		return null;
	}
}

export interface AcquireResult {
	ok: boolean;
	/** Set when refused: the live lock currently held by another process. */
	heldBy?: LockInfo;
}

/**
 * Acquire the edit lock. Reclaims a stale (dead-pid) lock automatically. When a
 * LIVE lock is held by another process, refuses unless `force`.
 */
export function acquireEditLock(planDir: string, port: number, force: boolean): AcquireResult {
	const lockPath = path.join(planDir, LOCK_FILE);
	const payload = `${JSON.stringify({ pid: process.pid, port, startedAt: new Date().toISOString() } satisfies LockInfo, null, 2)}\n`;
	try {
		// Atomic create-if-absent: the first writer wins the O_EXCL race outright,
		// so a second concurrent `edit` cannot also "acquire" in a read→write gap.
		fs.writeFileSync(lockPath, payload, { flag: "wx" });
		return { ok: true };
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
	}
	// A lock already exists — refuse only a LIVE foreign lock without --force.
	const existing = readEditLock(planDir);
	if (existing && existing.pid !== process.pid && pidAlive(existing.pid) && !force) {
		return { ok: false, heldBy: existing };
	}
	fs.writeFileSync(lockPath, payload, "utf-8"); // reclaim stale / own / forced
	return { ok: true };
}

/** Release the lock IF this process owns it (never removes another process's lock). */
export function releaseEditLock(planDir: string): void {
	const existing = readEditLock(planDir);
	if (existing && existing.pid === process.pid) {
		try {
			fs.unlinkSync(path.join(planDir, LOCK_FILE));
		} catch {
			// best-effort
		}
	}
}
