// PID-based advisory file lock generalized over an arbitrary lock path.
// Acquires by exclusively creating the lock file (`wx`) and writing the
// owner PID + timestamp; reclaims a lock whose owner PID is dead or whose
// timestamp is older than STALE_LOCK_MS; serializes concurrent callers via a
// bounded spin. Replaces a per-call proper-lockfile dependency.
//
// The lock-file SHAPE (`<pid>\n<ms-epoch>\n`) and the reclaim rule (dead PID OR
// age > STALE_LOCK_MS) are a cross-language contract: the shell trace writer
// (hooks/append-trace.sh) contends on the SAME sidecar lock path with the SAME
// protocol, so a bash writer and a TypeScript writer mutually exclude. The sync
// variant below exists so a synchronous caller (the wiki trace adapter) shares
// that one primitive instead of forking a second locking scheme.
import { existsSync, mkdirSync, openSync, closeSync, writeSync, readFileSync, unlinkSync, renameSync, linkSync } from "node:fs";
import { mkdir, open, readFile, unlink, rename, link } from "node:fs/promises";
import { dirname } from "node:path";

const STALE_LOCK_MS = 60 * 1000;
const ACQUIRE_TIMEOUT_MS = 10 * 1000;
const RETRY_INTERVAL_MS = 100;

/** True when the PID is not a live process (so its lock may be reclaimed). */
function pidIsDead(pid: number): boolean {
	if (!Number.isFinite(pid) || pid <= 0) return true;
	try {
		process.kill(pid, 0);
		return false;
	} catch {
		return true;
	}
}

/** A lock is reclaimable when its owner PID is dead OR its timestamp is stale. */
function lockIsReclaimable(content: string): boolean {
	const [pidStr, tsStr] = content.split("\n");
	const pid = Number.parseInt(pidStr, 10);
	const ts = Number.parseInt(tsStr, 10);
	return pidIsDead(pid) || (Number.isFinite(ts) && Date.now() - ts > STALE_LOCK_MS);
}

/** A per-process reclaim scratch name — the target of the atomic rename that claims a stale lock. */
function reclaimName(lockPath: string): string {
	return `${lockPath}.${process.pid}.${Date.now()}.reclaim`;
}

// LIMITATION (crash-recovery only): reclaim can theoretically strand a lock in a microsecond
// window — a waiter moves a stale lock aside, a fresh acquirer wins open(wx) in that gap, and the
// waiter's restore loses. This only fires when a lock is ACTUALLY stale (dead PID or >60s old),
// i.e. after a crash; a normally-held lock (acquired for a few ms) is never seen as reclaimable,
// so this never affects the hot path. Fully closing it would need a heartbeat/mkdir lock — out of
// scope for these short-lived operations. The verified-reclaim below makes the common case (all
// waiters reclaiming the SAME stale lock) correct.
//
// Reclaim a lock we decided was stale, WITHOUT ever deleting a lock we did not verify:
//   1. Atomic rename lockPath → a private name (only one racer can move a given entry).
//   2. Re-read the moved file. If it equals the stale snapshot we inspected, it was genuinely the
//      stale lock → unlink it and compete for the lock via open(wx).
//   3. If it does NOT match, we moved a lock that changed under us (a fresh acquirer). Restore it
//      via link (fails rather than clobbers a still-newer lock), then drop our extra name.
async function reclaimStale(lockPath: string, snapshot: string): Promise<void> {
	const owned = reclaimName(lockPath);
	try {
		await rename(lockPath, owned);
	} catch {
		return; // another waiter already moved it — just retry the acquire loop
	}
	try {
		if ((await readFile(owned, "utf-8")) === snapshot) {
			await unlink(owned);
			return;
		}
	} catch {
		/* unreadable — fall through to restore/discard */
	}
	try {
		await link(owned, lockPath); // restore only if lockPath is free (EEXIST ⇒ a newer lock won)
	} catch {
		/* a newer lock already exists — discard our moved copy */
	}
	await unlink(owned).catch(() => undefined);
}

function reclaimStaleSync(lockPath: string, snapshot: string): void {
	const owned = reclaimName(lockPath);
	try {
		renameSync(lockPath, owned);
	} catch {
		return;
	}
	try {
		if (readFileSync(owned, "utf-8") === snapshot) {
			unlinkSync(owned);
			return;
		}
	} catch {
		/* fall through */
	}
	try {
		linkSync(owned, lockPath);
	} catch {
		/* newer lock exists */
	}
	try {
		unlinkSync(owned);
	} catch {
		/* already gone */
	}
}

function isErrnoCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === code
	);
}

async function acquireFileLock(lockPath: string): Promise<void> {
	const lockDir = dirname(lockPath);
	if (!existsSync(lockDir)) await mkdir(lockDir, { recursive: true });

	const myPid = process.pid;
	const startTime = Date.now();

	while (true) {
		try {
			const handle = await open(lockPath, "wx");
			await handle.writeFile(`${myPid}\n${Date.now()}\n`, "utf-8");
			await handle.close();
			return;
		} catch (err) {
			if (!isErrnoCode(err, "EEXIST")) throw err;
		}

		try {
			const content = await readFile(lockPath, "utf-8");
			if (lockIsReclaimable(content)) {
				await reclaimStale(lockPath, content);
				continue;
			}
		} catch {
			// Lock disappeared or unreadable between create and read — retry.
		}

		if (Date.now() - startTime > ACQUIRE_TIMEOUT_MS) {
			throw new Error(`Could not acquire lock ${lockPath} within ${ACQUIRE_TIMEOUT_MS / 1000}s`);
		}
		await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
	}
}

async function releaseFileLock(lockPath: string): Promise<void> {
	try {
		await unlink(lockPath);
	} catch {
		// Best-effort: the lock may already be gone (reclaimed as stale).
	}
}

/** Run `operation` while holding an exclusive lock at `lockPath`. */
export async function withFileLock<T>(lockPath: string, operation: () => Promise<T>): Promise<T> {
	await acquireFileLock(lockPath);
	try {
		return await operation();
	} finally {
		await releaseFileLock(lockPath);
	}
}

/** Sleep synchronously without a busy loop (used only inside the bounded lock spin). */
function sleepSync(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireFileLockSync(lockPath: string): void {
	const lockDir = dirname(lockPath);
	if (!existsSync(lockDir)) mkdirSync(lockDir, { recursive: true });
	const startTime = Date.now();
	for (;;) {
		try {
			const fd = openSync(lockPath, "wx");
			writeSync(fd, `${process.pid}\n${Date.now()}\n`);
			closeSync(fd);
			return;
		} catch (err) {
			if (!isErrnoCode(err, "EEXIST")) throw err;
		}
		try {
			const content = readFileSync(lockPath, "utf-8");
			if (lockIsReclaimable(content)) {
				reclaimStaleSync(lockPath, content);
				continue;
			}
		} catch {
			// Lock vanished between create and read — retry.
		}
		if (Date.now() - startTime > ACQUIRE_TIMEOUT_MS) {
			throw new Error(`Could not acquire lock ${lockPath} within ${ACQUIRE_TIMEOUT_MS / 1000}s`);
		}
		sleepSync(RETRY_INTERVAL_MS);
	}
}

function releaseFileLockSync(lockPath: string): void {
	try {
		unlinkSync(lockPath);
	} catch {
		/* best-effort — may already be reclaimed as stale */
	}
}

/**
 * Synchronous sibling of `withFileLock` using the IDENTICAL sidecar protocol (same file shape,
 * same reclaim rule). A sync caller and an async caller contending on the same `lockPath` mutually
 * exclude, so there is one lock primitive, not two.
 */
export function withFileLockSync<T>(lockPath: string, operation: () => T): T {
	acquireFileLockSync(lockPath);
	try {
		return operation();
	} finally {
		releaseFileLockSync(lockPath);
	}
}
