/**
 * Crash-safe same-directory atomic write.
 *
 * Behavior extracted verbatim from the plan writer's atomic-write: write to a
 * same-directory temp file, then `renameSync` (atomic on POSIX because tmp and
 * target share a filesystem). A single Windows EPERM retry covers the case where
 * the target is briefly locked. `try/finally` unlinks the temp on any throw, so
 * a failed write never leaves an orphan. The temp prefix is dotted so orphaned
 * temps never match a caller's content-file glob.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

const TMP_PREFIX = ".local-web-tmp-";
const ORPHAN_AGE_MS = 5 * 60 * 1000; // 5 minutes

/** Write `content` to `targetPath` atomically via a same-directory temp file. */
export function atomicWriteFileSync(targetPath: string, content: string): void {
	const dir = path.dirname(targetPath);
	const tmpPath = path.join(dir, `${TMP_PREFIX}${crypto.randomBytes(6).toString("hex")}`);
	fs.writeFileSync(tmpPath, content, "utf-8");
	try {
		try {
			fs.renameSync(tmpPath, targetPath);
		} catch (err) {
			const e = err as NodeJS.ErrnoException;
			if (e.code === "EPERM") {
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
				fs.renameSync(tmpPath, targetPath);
			} else {
				throw err;
			}
		}
	} catch (err) {
		try {
			fs.unlinkSync(tmpPath);
		} catch {
			// best-effort cleanup; surface the original error
		}
		throw err;
	}
}

/** Remove `TMP_PREFIX` temps older than the orphan age in `dir` (best-effort). */
export function cleanOrphanedTmps(dir: string): void {
	let entries: string[];
	try {
		entries = fs.readdirSync(dir);
	} catch {
		return;
	}
	const now = Date.now();
	for (const name of entries) {
		if (!name.startsWith(TMP_PREFIX)) continue;
		const full = path.join(dir, name);
		try {
			if (now - fs.statSync(full).mtimeMs > ORPHAN_AGE_MS) fs.unlinkSync(full);
		} catch {
			// entry may be gone or inaccessible — skip
		}
	}
}
