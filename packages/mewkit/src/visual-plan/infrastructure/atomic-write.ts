/**
 * Crash-safe same-directory atomic write (Phase-1 inline copy).
 *
 * Same-dir tmp + renameSync (atomic on POSIX because tmp and target share a
 * filesystem). A self-contained copy local to the visual-plan module; the
 * shared `local-web/atomic-write.ts` is the general-purpose primitive. The tmp
 * prefix keeps orphaned temps from ever matching the `phase-NN-*.md` glob.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

const TMP_PREFIX = ".visual-plan-tmp-";

/** Write `content` to `targetPath` atomically via a same-directory temp file. */
export function atomicWriteFileSync(targetPath: string, content: string): void {
	const dir = path.dirname(targetPath);
	const tmpPath = path.join(dir, `${TMP_PREFIX}${crypto.randomBytes(6).toString("hex")}`);
	fs.writeFileSync(tmpPath, content, "utf-8");
	try {
		try {
			fs.renameSync(tmpPath, targetPath);
		} catch (error) {
			const e = error as NodeJS.ErrnoException;
			if (e.code === "EPERM") {
				// Windows: target may be briefly locked by another process. Single retry.
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
				fs.renameSync(tmpPath, targetPath);
			} else {
				throw error;
			}
		}
	} catch (error) {
		try {
			fs.unlinkSync(tmpPath);
		} catch {
			// best-effort cleanup; surface the original error
		}
		throw error;
	}
}
