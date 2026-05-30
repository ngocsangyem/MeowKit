// Locked, atomic writer for the canonical installed `.claude/metadata.json`.
// Serializes concurrent init/upgrade/migrate writers via a per-project lock and
// publishes via temp-file + rename so a reader never observes a partial file.
import { rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withFileLock } from "./file-lock.js";
import { INSTALL_METADATA_FILENAME, type InstallMetadata } from "./install-metadata.js";

const LOCK_FILENAME = ".metadata.lock";

/** Atomically write `.claude/metadata.json` under a per-project lock. */
export async function writeInstallMetadata(claudeDir: string, meta: InstallMetadata): Promise<void> {
	const lockPath = join(claudeDir, LOCK_FILENAME);
	const targetPath = join(claudeDir, INSTALL_METADATA_FILENAME);
	const serialized = JSON.stringify(meta, null, 2) + "\n";

	await withFileLock(lockPath, async () => {
		const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
		try {
			await writeFile(tempPath, serialized, "utf-8");
			await rename(tempPath, targetPath);
		} catch (error) {
			try {
				await unlink(tempPath);
			} catch {
				/* best-effort cleanup of the temp file */
			}
			throw error;
		}
	});
}
