// A copy of every file a command is about to change, taken before it changes any.
//
// The point is not backup in the general sense; it is that `init`, `upgrade` and
// `uninstall` each decide, from metadata, that a file is safe to overwrite or
// delete. When that decision is wrong the file is already gone, and the user's
// only recourse is version control — which does not cover the untracked half of
// `.meowkit/`. One snapshot per run, written before the first mutation, turns an
// irreversible run into a reversible one.
//
// `.meowkit/cache/` is excluded on purpose. It is the local copy of the kit and
// is re-fetchable by `mewkit upgrade`, so snapshotting it would multiply every
// backup by the size of a whole kit for no recovery value.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";

import { hashFile } from "./compute-checksums.js";

export const BACKUPS_REL = join(".meowkit", "backups");
const MANIFEST = "manifest.json";
const FILES_DIR = "files";

/** Re-derivable content, never snapshotted. */
const EXCLUDED_PREFIX = `.meowkit${sep}cache${sep}`;

export interface SnapshotEntry {
	/** Project-relative path, in this platform's separator. */
	path: string;
	/** SHA-256 of the file before the mutation. */
	checksum: string;
}

export interface SnapshotManifest {
	id: string;
	createdAt: string;
	/** The command that took it, so `backups list` can say what it was for. */
	command: string;
	fileCount: number;
	files: SnapshotEntry[];
}

export const snapshotDir = (root: string, id: string): string => join(root, BACKUPS_REL, id);
const manifestPath = (root: string, id: string): string => join(snapshotDir(root, id), MANIFEST);

/** A sortable, human-readable id: the instant plus the command that took it. */
export function snapshotId(command: string, now: Date = new Date(), suffix = ""): string {
	const stamp = now
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d+Z$/, "Z");
	return `${stamp}-${command}${suffix}`;
}

/** The id nothing has used yet, so two runs in the same second cannot collide. */
function freeId(root: string, command: string, now: Date): string {
	let n = 0;
	for (;;) {
		const id = snapshotId(command, now, n === 0 ? "" : `-${n}`);
		if (!existsSync(snapshotDir(root, id))) return id;
		n += 1;
	}
}

/** Every file under `dir`, project-relative, for expanding a directory target. */
function walk(root: string, dir: string, out: string[]): void {
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) walk(root, full, out);
		else out.push(full.slice(root.length + 1));
	}
}

/**
 * Expand directories into their files, drop excluded and duplicate paths, keep
 * a stable order.
 *
 * A target that is not on disk is dropped rather than recorded as "was absent".
 * A snapshot answers "what did this file hold before", and for a path that held
 * nothing the answer is not recoverable content — it is a deletion, which a
 * restore has no mandate to perform. A fresh install therefore snapshots
 * nothing, which is correct: it overwrites nothing.
 */
export function resolveTargets(root: string, relPaths: readonly string[]): string[] {
	const seen = new Set<string>();
	for (const rel of relPaths) {
		const normal = rel.split("/").join(sep);
		if (normal.startsWith(EXCLUDED_PREFIX)) continue;
		const full = join(root, normal);
		if (!existsSync(full)) continue;
		if (statSync(full).isDirectory()) {
			const nested: string[] = [];
			walk(root, full, nested);
			for (const n of nested) if (!n.startsWith(EXCLUDED_PREFIX)) seen.add(n);
			continue;
		}
		seen.add(normal);
	}
	return [...seen].sort();
}

/**
 * Write the snapshot and return its manifest, or `null` when there is nothing
 * to record. A dry run must call this not at all: writing nothing is the whole
 * promise, and a backup directory is a write.
 */
export function createSnapshot(
	root: string,
	command: string,
	relPaths: readonly string[],
	now = new Date(),
): SnapshotManifest | null {
	const targets = resolveTargets(root, relPaths);
	if (targets.length === 0) return null;

	const id = freeId(root, command, now);
	const dir = snapshotDir(root, id);
	const files: SnapshotEntry[] = [];

	for (const rel of targets) {
		const source = join(root, rel);
		const dest = join(dir, FILES_DIR, rel);
		mkdirSync(dirname(dest), { recursive: true });
		copyFileSync(source, dest);
		files.push({ path: rel, checksum: hashFile(source) });
	}

	const manifest: SnapshotManifest = {
		id,
		createdAt: now.toISOString(),
		command,
		fileCount: files.length,
		files,
	};
	mkdirSync(dir, { recursive: true });
	// The manifest is written LAST, so a run interrupted mid-copy leaves a
	// directory without one rather than a manifest promising files that are not
	// there. `backups list` reads manifests, so an incomplete snapshot is
	// invisible instead of misleading.
	writeFileSync(manifestPath(root, id), `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
	return manifest;
}

/** The file inside a snapshot holding one recorded path. */
export const snapshotFilePath = (root: string, id: string, rel: string): string =>
	join(snapshotDir(root, id), FILES_DIR, rel);

/** Read one manifest, or null when the id names nothing readable. */
export function readSnapshot(root: string, id: string): SnapshotManifest | null {
	const file = manifestPath(root, id);
	if (!existsSync(file)) return null;
	try {
		return JSON.parse(readFileSync(file, "utf-8")) as SnapshotManifest;
	} catch {
		return null;
	}
}

/** Every readable snapshot, newest first. */
export function listSnapshots(root: string): SnapshotManifest[] {
	const base = join(root, BACKUPS_REL);
	if (!existsSync(base)) return [];
	const found: SnapshotManifest[] = [];
	for (const entry of readdirSync(base, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const manifest = readSnapshot(root, entry.name);
		if (manifest !== null) found.push(manifest);
	}
	return found.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
