// Process-wide migration lock. Prevents two `mewkit migrate` runs from racing on the
// same registry. Uses a PID file with stale-detection via process.kill(0). The
// project-scope lockfile lives under the runtime-neutral state root
// (`.meowkit/state/migrate.lock`) — the single project-lock authority. A crashed
// old-version run may still hold the legacy `.mewkit/.lock`; acquisition reconciles
// that path so a stale legacy lock can never deadlock a new run.
import { existsSync } from "node:fs";
import { mkdir, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { meowkitStatePaths } from "../../state/meowkit-state-paths.js";

export interface AcquireLockResult {
	acquired: boolean;
	heldBy?: number;
	lockPath: string;
}

export interface ProcessLockOptions {
	scope: "project" | "global";
	/** Explicit project root for a project-scope lock. Defaults to `process.cwd()`.
	 *  Lets a migration transaction lock the TARGET project rather than the shell's
	 *  cwd (they differ in tests and in multi-project sessions). */
	projectRoot?: string;
}

/** Resolve lock path at call time so `process.cwd()` reflects the actual invocation
 *  context (matters for tests that change directories and for users running mewkit
 *  in different projects within one session). */
function getLockPath(options: ProcessLockOptions): string {
	return options.scope === "project"
		? meowkitStatePaths(join(options.projectRoot ?? process.cwd(), ".meowkit")).migrateLock
		: join(homedir(), ".mewkit", ".lock");
}

/** Legacy project lockfile path (pre-`.meowkit/` migration). */
function legacyProjectLockPath(projectRoot?: string): string {
	return join(projectRoot ?? process.cwd(), ".mewkit", ".lock");
}

/**
 * Reconcile the legacy `.mewkit/.lock` before acquiring the new lock. Returns the
 * live holder PID when a legacy run is genuinely still active (caller must not
 * acquire); removes a stale legacy lock and returns null otherwise.
 */
async function reconcileLegacyProjectLock(projectRoot?: string): Promise<number | null> {
	const legacy = legacyProjectLockPath(projectRoot);
	if (!existsSync(legacy)) return null;
	try {
		const pid = Number.parseInt((await readFile(legacy, "utf-8")).trim().split("\n")[0] ?? "", 10);
		if (isProcessAlive(pid)) return pid; // a real old-version run holds it
		await unlink(legacy); // stale — clear so it can't deadlock a new run
	} catch {
		// Unreadable/vanished — treat as clear.
	}
	return null;
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
export async function acquireMigrationLock(options: ProcessLockOptions): Promise<AcquireLockResult> {
	const lockPath = getLockPath(options);
	if (options.scope === "project") {
		const legacyHolder = await reconcileLegacyProjectLock(options.projectRoot);
		if (legacyHolder !== null)
			return { acquired: false, heldBy: legacyHolder, lockPath: legacyProjectLockPath(options.projectRoot) };
	}
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
				if (isProcessAlive(pid)) return { acquired: false, heldBy: pid, lockPath };
				await unlink(lockPath);
				return acquireMigrationLock(options);
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
	// Leave no empty lock directory behind in the target project. rmdir only
	// succeeds on an EMPTY directory, so a home-scope dir that also holds the
	// portable registry — or a real `.meowkit/` holding migrated state — is never
	// touched. The project lock nests two levels deep (`.meowkit/state/migrate.lock`),
	// so prune the now-empty `state/` and then the `.meowkit/` root as well, but only
	// when they are genuinely the transient lock tree (basename guard prevents ever
	// climbing into `~` or the project root).
	const lockDir = dirname(lockPath);
	try {
		await rmdir(lockDir);
	} catch {
		return; // non-empty or gone — nothing left to prune
	}
	if (basename(lockDir) === "state" && basename(dirname(lockDir)) === ".meowkit") {
		try {
			await rmdir(dirname(lockDir));
		} catch {
			// `.meowkit/` still holds other state — leave it.
		}
	}
}
