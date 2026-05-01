/**
 * atomic-write — same-dir tmp + renameSync for crash-safe file writes.
 *
 * Security: tmp filename uses .orchviz-tmp- prefix so phase-glob regex
 * (/^phase-0*N-.*\.md$/i) never matches orphaned temps (R2-1, R2-13).
 *
 * Reliability:
 *   - renameSync is atomic on POSIX (same filesystem guaranteed by same-dir tmp).
 *   - Windows EPERM (file open in another process) → single 50ms retry.
 *   - try/finally unlinks tmp on every error path — no orphan on throw.
 *
 * Orphan cleanup: cleanOrphanedTmps(planDir) removes .orchviz-tmp-* files
 * older than 5 minutes. Called on first write per slug (R2-13).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const TMP_PREFIX = ".orchviz-tmp-";
const ORPHAN_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Write `content` to `targetPath` atomically via a same-directory temp file.
 * Throws on persistent failure (after Windows EPERM retry).
 */
export function atomicWriteFileSync(targetPath: string, content: string): void {
	const dir = path.dirname(targetPath);
	const rand = crypto.randomBytes(6).toString("hex");
	const tmpPath = path.join(dir, `${TMP_PREFIX}${rand}`);

	fs.writeFileSync(tmpPath, content, "utf-8");
	try {
		try {
			fs.renameSync(tmpPath, targetPath);
		} catch (err) {
			const e = err as NodeJS.ErrnoException;
			if (e.code === "EPERM") {
				// Windows: file may be open in another process. Single 50ms retry.
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
				fs.renameSync(tmpPath, targetPath);
			} else {
				throw err;
			}
		}
	} catch (err) {
		// Clean up tmp on any rename failure
		try {
			fs.unlinkSync(tmpPath);
		} catch {
			// Best-effort; suppress secondary error
		}
		throw err;
	}
	// renameSync succeeded — tmp no longer exists (renamed to target), nothing to unlink.
}

/**
 * Remove .orchviz-tmp-* files older than ORPHAN_AGE_MS in planDir.
 * Silently skips if dir doesn't exist or entry stat fails (R2-13).
 */
export function cleanOrphanedTmps(planDir: string): void {
	let entries: string[];
	try {
		entries = fs.readdirSync(planDir);
	} catch {
		return;
	}
	const now = Date.now();
	for (const name of entries) {
		if (!name.startsWith(TMP_PREFIX)) continue;
		const fullPath = path.join(planDir, name);
		try {
			const stat = fs.statSync(fullPath);
			if (now - stat.mtimeMs > ORPHAN_AGE_MS) {
				fs.unlinkSync(fullPath);
			}
		} catch {
			// Skip — file may already be gone or inaccessible
		}
	}
}
