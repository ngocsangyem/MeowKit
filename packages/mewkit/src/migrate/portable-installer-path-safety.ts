// Path-safety helpers for the portable installer. Validates target paths against a project /
// home boundary and rejects symlink components to prevent traversal-via-symlink attacks.
import { existsSync } from "node:fs";
import { lstat, mkdir, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

function isPathWithinBoundary(targetPath: string, boundaryPath: string): boolean {
	const resolvedTarget = resolve(targetPath);
	const resolvedBoundary = resolve(boundaryPath);
	return resolvedTarget === resolvedBoundary || resolvedTarget.startsWith(`${resolvedBoundary}${sep}`);
}

async function resolveCanonicalPath(path: string): Promise<string> {
	const resolved = resolve(path);
	let cursor = resolved;
	const suffix: string[] = [];

	while (!existsSync(cursor)) {
		const parent = dirname(cursor);
		if (parent === cursor) break;
		suffix.unshift(cursor.slice(parent.length + 1));
		cursor = parent;
	}

	const canonicalBase = existsSync(cursor) ? await realpath(cursor) : cursor;
	return suffix.length === 0 ? canonicalBase : join(canonicalBase, ...suffix);
}

async function validateNoSymlinkComponents(targetPath: string, boundaryPath: string): Promise<string | null> {
	const resolvedTarget = await resolveCanonicalPath(targetPath);
	const resolvedBoundary = await resolveCanonicalPath(boundaryPath);

	if (!isPathWithinBoundary(resolvedTarget, resolvedBoundary)) {
		return `Unsafe path: target escapes ${resolvedBoundary}`;
	}

	const segments = relative(resolvedBoundary, resolvedTarget)
		.split(/[\\/]+/)
		.filter(Boolean);
	let cursor = resolvedBoundary;
	for (const segment of segments) {
		cursor = join(cursor, segment);
		try {
			const stats = await lstat(cursor);
			if (stats.isSymbolicLink()) {
				return `Unsafe path: target path contains symlink (${cursor})`;
			}
		} catch (error) {
			if (
				typeof error === "object" &&
				error !== null &&
				"code" in error &&
				(error as NodeJS.ErrnoException).code === "ENOENT"
			) {
				break;
			}
			throw error;
		}
	}

	return null;
}

export async function validateWritableTargetPath(
	targetPath: string,
	options: { global: boolean },
): Promise<string | null> {
	const boundary = options.global ? homedir() : process.cwd();
	return validateNoSymlinkComponents(targetPath, boundary);
}

export async function atomicWrite(target: string, content: string): Promise<void> {
	const dir = dirname(target);
	if (!existsSync(dir)) await mkdir(dir, { recursive: true });
	const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
	try {
		await writeFile(tmp, content, "utf-8");
		await rename(tmp, target);
	} catch (err) {
		try {
			await unlink(tmp);
		} catch {
			/* best-effort */
		}
		throw err;
	}
}
