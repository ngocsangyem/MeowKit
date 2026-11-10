// Scan-SURFACE discovery for the committed team-memory store, kept separate from the lint
// that interprets what it finds.
//
// The surface is derived from the documented READ, not from a guess about it: read-set skills
// run `grep -ril "<task keywords>" .meowkit/memory/`, which is recursive and not
// extension-filtered. So the walk is recursive and returns every regular file — and anything
// it cannot traverse is reported as unreadable rather than skipped, because a guard that
// silently drops what it cannot open is worse than no guard at all.
import fs from "node:fs";
import path from "node:path";
import type { MemoryFindingKind } from "../state/memory-content-scan.js";

/** Bounded recursion so a deep or symlinked tree can never spin the walk. */
const MAX_WALK_DEPTH = 12;

export interface StoreWalkResult {
	/** Regular files to scan, in stable order. */
	files: string[];
	/** Paths the walk could not traverse — each one is a FAIL finding, not a skip. */
	unreadable: { path: string; detail: string }[];
}

export type ReadForScanResult =
	{ body: string } | { finding: { line: number; kind: MemoryFindingKind; detail: string } };

export function errnoOf(error: unknown): string {
	if (typeof error === "object" && error !== null && "code" in error) {
		return String((error as NodeJS.ErrnoException).code);
	}
	return "unknown error";
}

/** Walk the store the way the documented `grep -ril` read does: recursively, every file. */
export function walkStore(dir: string, depth = 0): StoreWalkResult {
	const out: StoreWalkResult = { files: [], unreadable: [] };
	if (depth > MAX_WALK_DEPTH) {
		out.unreadable.push({ path: dir, detail: `nesting deeper than ${MAX_WALK_DEPTH} levels was not scanned` });
		return out;
	}
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch (error) {
		out.unreadable.push({ path: dir, detail: `directory could not be read (${errnoOf(error)})` });
		return out;
	}
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			const nested = walkStore(full, depth + 1);
			out.files.push(...nested.files);
			out.unreadable.push(...nested.unreadable);
		} else if (entry.isFile()) {
			out.files.push(full);
		} else if (entry.isSymbolicLink()) {
			// Never followed: a symlink out of the store is a delivery channel the reviewer
			// cannot see in the diff. Reported so it cannot pass unnoticed either.
			out.unreadable.push({ path: full, detail: "symbolic link in the store — not followed, not scanned" });
		} else {
			out.unreadable.push({ path: full, detail: "not a regular file — not scanned" });
		}
	}
	return out;
}

/** Read one store file, gating on size BEFORE the string read so an oversized file cannot
 *  throw ERR_STRING_TOO_LONG into a swallowed catch. */
export function readForScan(fullPath: string, maxBytes: number): ReadForScanResult {
	let size: number;
	try {
		size = fs.statSync(fullPath).size;
	} catch (error) {
		return { finding: { line: 0, kind: "unreadable", detail: `could not be stat'd (${errnoOf(error)})` } };
	}
	if (size > maxBytes) {
		return {
			finding: {
				line: 0,
				kind: "byte-cap",
				detail: `${size} bytes exceeds the ${maxBytes}-byte cap — not scanned; prune or split the store`,
			},
		};
	}
	try {
		return { body: fs.readFileSync(fullPath, "utf-8") };
	} catch (error) {
		return { finding: { line: 0, kind: "unreadable", detail: `could not be read (${errnoOf(error)})` } };
	}
}
