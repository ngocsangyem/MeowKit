// Vendored from claudekit-cli (MIT). Source: src/commands/portable/codex-path-safety.ts
// Adapted: PID-based lock instead of proper-lockfile (no new dep).
import { existsSync } from "node:fs";
import { mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

const STALE_LOCK_MS = 60 * 1000;

export function isPathWithinBoundary(targetPath: string, boundaryPath: string): boolean {
	const resolvedTarget = resolve(targetPath);
	const resolvedBoundary = resolve(boundaryPath);
	return resolvedTarget === resolvedBoundary || resolvedTarget.startsWith(`${resolvedBoundary}${sep}`);
}

async function resolveRealPathSafe(path: string): Promise<string> {
	try {
		return await realpath(path);
	} catch {
		return resolve(path);
	}
}

export async function isCanonicalPathWithinBoundary(targetPath: string, boundaryPath: string): Promise<boolean> {
	const canonicalTarget = await resolveRealPathSafe(targetPath);
	const canonicalBoundary = await resolveRealPathSafe(boundaryPath);
	return isPathWithinBoundary(canonicalTarget, canonicalBoundary);
}

function getCodexLockPath(targetFilePath: string): string {
	return join(dirname(resolve(targetFilePath)), ".config.toml.mewkit-codex.lock");
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

async function acquireCodexLock(lockPath: string): Promise<void> {
	const startTime = Date.now();
	while (true) {
		try {
			await writeFile(lockPath, `${process.pid}\n${Date.now()}\n`, { encoding: "utf-8", flag: "wx" });
			return;
		} catch (err: unknown) {
			const e = err as NodeJS.ErrnoException;
			if (e.code !== "EEXIST") throw err;
		}

		try {
			const content = (await readFile(lockPath, "utf-8")).trim();
			const [pidStr, tsStr] = content.split("\n");
			const pid = Number.parseInt(pidStr ?? "", 10);
			const ts = Number.parseInt(tsStr ?? "", 10);
			if (!isProcessAlive(pid) || (Number.isFinite(ts) && Date.now() - ts > STALE_LOCK_MS)) {
				try {
					await unlink(lockPath);
				} catch {
					/* race */
				}
				continue;
			}
		} catch {
			// Lock disappeared between checks
		}

		if (Date.now() - startTime > 10_000) {
			throw new Error(`Could not acquire Codex lock at ${lockPath} within 10s`);
		}
		await new Promise((r) => setTimeout(r, 100));
	}
}

async function releaseCodexLock(lockPath: string): Promise<void> {
	try {
		await unlink(lockPath);
	} catch {
		// Best-effort
	}
}

export async function withCodexTargetLock<T>(targetFilePath: string, operation: () => Promise<T>): Promise<T> {
	const resolvedTargetPath = resolve(targetFilePath);
	const dir = dirname(resolvedTargetPath);

	if (!existsSync(dir)) await mkdir(dir, { recursive: true });

	const lockPath = getCodexLockPath(resolvedTargetPath);
	await acquireCodexLock(lockPath);
	try {
		return await operation();
	} finally {
		await releaseCodexLock(lockPath);
	}
}

export function getCodexGlobalBoundary(): string {
	return join(homedir(), ".codex");
}

/**
 * The single canonical Codex root for the given scope.
 * - global: <home>/.codex
 * - project: <cwd>/.codex
 *
 * Always absolute. This is the ONE place a Codex root is computed so no caller
 * has to string-concatenate a project root onto a path — the source of the
 * doubled-root bug (`node "/root//root/.codex/hooks/x.cjs"`) observed in real
 * migrations, where a relative ".codex/hooks" path config was resolved against
 * cwd in one place and prefixed with the project root again in another.
 */
export function getCodexRoot(options: { global: boolean }): string {
	return options.global ? getCodexGlobalBoundary() : resolve(process.cwd(), ".codex");
}

/**
 * Resolve a Codex target path to a single, absolute, non-doubled form.
 *
 * `target` may be:
 * - already absolute (an installer computed it) → returned as-is (idempotent),
 * - the literal ".codex/..." project-relative form from the provider registry,
 * - or any other relative fragment → joined onto the scope's Codex root.
 *
 * Never derives the path from string content or interpolation — only from the
 * literal path table and the computed root, so a project root can never be
 * prepended twice.
 */
export function resolveCodexTargetPath(target: string, options: { global: boolean }): string {
	if (isAbsolute(target)) return resolve(target);

	const codexRoot = getCodexRoot(options);
	// Strip a leading ".codex/" (or ".codex") segment so we never nest
	// ".codex/.codex/..." when the registry path already carries the prefix.
	const normalized = target.replace(/^\.?[/\\]?\.codex[/\\]?/, "");
	return normalized.length > 0 ? resolve(codexRoot, normalized) : codexRoot;
}
