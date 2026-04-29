// Process-wide migration lock (Red Team Finding 13). Prevents two `mewkit migrate` runs
// from racing on the same registry. Uses a PID file with stale-detection via process.kill(0).
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface AcquireLockResult {
	acquired: boolean;
	heldBy?: number;
	lockPath: string;
}

export interface ProcessLockOptions {
	scope: "project" | "global";
}

/** Resolve lock path at call time so `process.cwd()` reflects the actual invocation
 *  context (matters for tests that change directories and for users running mewkit
 *  in different projects within one session). */
function getLockPath(scope: "project" | "global"): string {
	return scope === "project"
		? join(process.cwd(), ".mewkit", ".lock")
		: join(homedir(), ".mewkit", ".lock");
}

function isProcessAlive(pid: number): boolean {
	if (!Number.isFinite(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Acquire a migration lock. Returns result; caller checks `.acquired`.
 * If the lock exists with a dead PID, automatically clears stale lock and retries once.
 */
export async function acquireMigrationLock(
	options: ProcessLockOptions,
): Promise<AcquireLockResult> {
	const lockPath = getLockPath(options.scope);
	const dir = dirname(lockPath);
	if (!existsSync(dir)) await mkdir(dir, { recursive: true });

	if (existsSync(lockPath)) {
		try {
			const content = (await readFile(lockPath, "utf-8")).trim();
			const pid = Number.parseInt(content.split("\n")[0] ?? "", 10);
			if (isProcessAlive(pid)) {
				return { acquired: false, heldBy: pid, lockPath };
			}
			// Stale lock — remove and try acquiring
			await unlink(lockPath);
		} catch {
			// Read or unlink failed — fall through and try to write the lock
		}
	}

	const payload = `${process.pid}\n${Date.now()}\n`;
	try {
		await writeFile(lockPath, payload, { encoding: "utf-8", flag: "wx" });
		return { acquired: true, lockPath };
	} catch (err: unknown) {
		const e = err as NodeJS.ErrnoException;
		if (e.code === "EEXIST") {
			try {
				const content = (await readFile(lockPath, "utf-8")).trim();
				const pid = Number.parseInt(content.split("\n")[0] ?? "", 10);
				return { acquired: false, heldBy: pid, lockPath };
			} catch {
				return { acquired: false, lockPath };
			}
		}
		throw err;
	}
}

export async function releaseMigrationLock(lockPath: string): Promise<void> {
	try {
		await unlink(lockPath);
	} catch {
		// Best-effort
	}
}
