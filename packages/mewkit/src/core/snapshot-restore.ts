// Put a snapshot back, and record what putting it back overwrote.
//
// A restore is itself a mutation, so it takes its own snapshot first. Without
// that, recovering from a bad upgrade would destroy whatever the user did
// between the upgrade and the recovery — which turns one irreversible step into
// two.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { hashFile } from "./compute-checksums.js";
import { createSnapshot, readSnapshot, snapshotFilePath, type SnapshotManifest } from "./snapshot.js";

export interface RestoreResult {
	id: string;
	/** Files written back, with the checksum they were restored to. */
	restored: { path: string; checksum: string }[];
	/** Files already byte-identical, left untouched. */
	unchanged: string[];
	/** The snapshot taken of the pre-restore state, so the restore is undoable. */
	undoId: string | null;
}

export class UnknownSnapshotError extends Error {
	constructor(
		readonly id: string,
		readonly available: string[],
	) {
		super(
			available.length === 0
				? `No snapshot named ${id}, and this project has none. A snapshot is written by init, upgrade and uninstall.`
				: `No snapshot named ${id}. Available: ${available.join(", ")}`,
		);
		this.name = "UnknownSnapshotError";
	}
}

/** What a restore would do, without doing it. */
export function planRestore(root: string, manifest: SnapshotManifest): { write: string[]; unchanged: string[] } {
	const write: string[] = [];
	const unchanged: string[] = [];
	for (const entry of manifest.files) {
		const target = join(root, entry.path);
		if (existsSync(target) && hashFile(target) === entry.checksum) unchanged.push(entry.path);
		else write.push(entry.path);
	}
	return { write, unchanged };
}

/**
 * Restore one snapshot. Throws `UnknownSnapshotError` for an id this project
 * does not have, listing the ids it does — a bare "not found" leaves the user
 * running a second command to learn what to type.
 */
export function restoreSnapshot(root: string, id: string, available: string[], dryRun = false): RestoreResult {
	const manifest = readSnapshot(root, id);
	if (manifest === null) throw new UnknownSnapshotError(id, available);

	const plan = planRestore(root, manifest);
	const undo = dryRun || plan.write.length === 0 ? null : createSnapshot(root, "backups-restore", plan.write);

	const checksums = new Map(manifest.files.map((f) => [f.path, f.checksum]));
	const restored: { path: string; checksum: string }[] = [];
	for (const rel of plan.write) {
		const source = snapshotFilePath(root, id, rel);
		if (!existsSync(source)) continue;
		const target = join(root, rel);
		if (!dryRun) {
			mkdirSync(dirname(target), { recursive: true });
			copyFileSync(source, target);
		}
		restored.push({ path: rel, checksum: checksums.get(rel) ?? "" });
	}
	return { id, restored, unchanged: plan.unchanged, undoId: undo?.id ?? null };
}
