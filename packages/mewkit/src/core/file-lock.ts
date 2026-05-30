// PID-based advisory file lock generalized over an arbitrary lock path.
// Acquires by exclusively creating the lock file (`wx`) and writing the
// owner PID + timestamp; reclaims a lock whose owner PID is dead or whose
// timestamp is older than STALE_LOCK_MS; serializes concurrent callers via a
// bounded spin. Replaces a per-call proper-lockfile dependency.
import { existsSync } from "node:fs";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { dirname } from "node:path";

const STALE_LOCK_MS = 60 * 1000;
const ACQUIRE_TIMEOUT_MS = 10 * 1000;
const RETRY_INTERVAL_MS = 100;

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
			const [pidStr, tsStr] = content.split("\n");
			const pid = Number.parseInt(pidStr, 10);
			const ts = Number.parseInt(tsStr, 10);

			let alive = false;
			try {
				if (Number.isFinite(pid) && pid > 0) {
					process.kill(pid, 0);
					alive = true;
				}
			} catch {
				alive = false;
			}

			if (!alive || (Number.isFinite(ts) && Date.now() - ts > STALE_LOCK_MS)) {
				try {
					await unlink(lockPath);
				} catch {
					/* lost the reclaim race — another waiter cleaned it */
				}
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
