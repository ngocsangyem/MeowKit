// PID-based file lock for the portable registry. Extracted from portable-registry.ts.
// Replaces proper-lockfile dependency for mewkit's leaner footprint.
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const REGISTRY_LOCK_PATH = join(homedir(), ".mewkit", "portable-registry.lock");
const STALE_LOCK_MS = 60 * 1000;

function isErrnoCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === code
	);
}

/**
 * PID-based file lock. Acquires lock by writing PID; checks staleness via process.kill(pid, 0).
 */
async function acquireRegistryLock(): Promise<void> {
	const lockDir = dirname(REGISTRY_LOCK_PATH);
	if (!existsSync(lockDir)) await mkdir(lockDir, { recursive: true });

	const myPid = process.pid;
	const startTime = Date.now();

	while (true) {
		try {
			const handle = await import("node:fs").then((m) => m.promises.open(REGISTRY_LOCK_PATH, "wx"));
			await handle.writeFile(`${myPid}\n${Date.now()}\n`, "utf-8");
			await handle.close();
			return;
		} catch (err) {
			if (!isErrnoCode(err, "EEXIST")) throw err;
		}

		try {
			const content = await readFile(REGISTRY_LOCK_PATH, "utf-8");
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
					await unlink(REGISTRY_LOCK_PATH);
				} catch {
					/* race */
				}
				continue;
			}
		} catch {
			// Lock disappeared or unreadable — retry
		}

		if (Date.now() - startTime > 10_000) {
			throw new Error("Could not acquire portable-registry lock within 10s");
		}
		await new Promise((r) => setTimeout(r, 100));
	}
}

async function releaseRegistryLock(): Promise<void> {
	try {
		await unlink(REGISTRY_LOCK_PATH);
	} catch {
		// Best-effort
	}
}

export async function withRegistryLock<T>(operation: () => Promise<T>): Promise<T> {
	await acquireRegistryLock();
	try {
		return await operation();
	} finally {
		await releaseRegistryLock();
	}
}
