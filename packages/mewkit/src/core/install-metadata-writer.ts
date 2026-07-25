// Locked, atomic writer for the canonical installed metadata.
// Serializes concurrent init/upgrade/migrate writers via a per-project lock and
// publishes via temp-file + rename so a reader never observes a partial file.
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { withFileLock } from "./file-lock.js";
import { legacyMetadataPath, metadataLockPath, metadataWritePath } from "../state/resolve-metadata-path.js";
import { type InstallMetadata } from "./install-metadata.js";

/**
 * Atomically write `<root>/.meowkit/metadata.json` under a per-project lock, and retire a
 * pre-move `.claude/metadata.json` in the same operation.
 *
 * The retirement is the load-bearing part. Leaving both files behind gives a project two
 * baselines, and which one an upgrade compares against then depends on read order — so a user
 * edit is kept or overwritten by accident. Migrating on write means a project holds exactly one
 * baseline the moment it is first written by a post-move CLI.
 */
export async function writeInstallMetadata(projectRoot: string, meta: InstallMetadata): Promise<void> {
	const targetPath = metadataWritePath(projectRoot);
	const lockPath = metadataLockPath(projectRoot);
	const serialized = JSON.stringify(meta, null, 2) + "\n";

	await mkdir(dirname(targetPath), { recursive: true });

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
		// Only after the canonical file is published. Removing the old one first would leave a
		// project with no baseline at all if the write below it failed.
		const legacy = legacyMetadataPath(projectRoot);
		if (existsSync(legacy)) {
			try {
				await unlink(legacy);
			} catch {
				/* a read-only or already-removed pre-move file is not worth failing an install over */
			}
		}
	});
}
