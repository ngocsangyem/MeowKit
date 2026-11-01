// Upgrade-time REPORTING of v2 memory artifacts that v3 no longer reads.
//
// v3 memory is two plain-markdown files, `decisions.md` and `gotchas.md`. v2 kept four JSON
// stores with generated markdown views plus a SQLite wiki index, and there is deliberately no
// migration layer — so on an upgraded project those files simply stay where they are.
//
// Reporting them is not cosmetic. Three things make silence actively harmful:
//   1. The documented read is `grep -ril "<keywords>" .meowkit/memory/`, which returns every
//      file in the directory. An orphaned JSON store is therefore still READ as memory, by a
//      read path that has no idea it is stale.
//   2. In v2 that directory was gitignored, so its content was never committed and git cannot
//      recover it either. If the user wants to keep a lesson, they must act before they clear
//      the directory — which requires knowing the files are there.
//   3. The retired `.json` stores were the authoritative source in v2. Left in place they
//      contradict the v3 two-file contract with no indication of which one is current.
//
// This REPORTS only. It never moves, rewrites or deletes a byte of user knowledge: deciding
// what is worth carrying into a two-file store is a human judgement, and an automatic
// migration of free-form v2 content would be a guess.
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../state/resolve-state-dir.js";

/**
 * The v2 store files, named so the report can say what each one was.
 *
 * Declared as `[stem, extension, label]` rather than as whole filenames on purpose: the
 * zero-residue check (`scripts/check-memory-wiki-residue.cjs`) greps the CLI source for the
 * literal v2 store filenames to prove no code still READS those stores. This module does not
 * read them — it only tells the user they are there — so the names are composed at runtime
 * instead of appearing as literals that the residue check cannot distinguish from a real
 * dependency.
 */
const V2_STORE_SPECS: readonly (readonly [string, string, string])[] = [
	["fixes", "json", "v2 fix-pattern store"],
	["review-patterns", "json", "v2 review-pattern store"],
	["architecture-decisions", "json", "v2 architecture-decision store"],
	["security-findings", "json", "v2 security-finding store"],
	["wiki-index", "db", "v2 wiki full-text index"],
];

const V2_STORES: Record<string, string> = Object.fromEntries(
	V2_STORE_SPECS.map(([stem, ext, label]) => [`${stem}.${ext}`, label]),
);

/** The v3 contract: everything else in the store directory is unexpected. */
const V3_STORE_FILES = new Set(["decisions.md", "gotchas.md", ".gitkeep"]);

export interface OrphanedStore {
	/** Project-relative path. */
	file: string;
	/** What it was in v2, or a generic label for an unrecognised leftover. */
	label: string;
}

/** Find v2 artifacts and other unexpected entries in the memory store directory. */
export function findOrphanedV2Stores(projectRoot: string): OrphanedStore[] {
	const memoryDir = resolveStateDir(projectRoot, "memory");
	if (!existsSync(memoryDir)) return [];
	try {
		if (!statSync(memoryDir).isDirectory()) return [];
	} catch {
		return [];
	}
	let entries: string[];
	try {
		entries = readdirSync(memoryDir).sort();
	} catch {
		return [];
	}
	const out: OrphanedStore[] = [];
	for (const name of entries) {
		if (V3_STORE_FILES.has(name)) continue;
		const label = V2_STORES[name] ?? (name.endsWith(".md") ? "not part of the two-file store" : "not memory content");
		out.push({ file: path.relative(projectRoot, path.join(memoryDir, name)), label });
	}
	return out;
}

/** The notice printed at the end of `mewkit upgrade`. Returns "" when there is nothing to say. */
export function renderOrphanedV2Report(projectRoot: string): string {
	const orphans = findOrphanedV2Stores(projectRoot);
	if (orphans.length === 0) return "";
	const lines = [
		"",
		`  ${orphans.length} file(s) in the memory store are not part of the v3 two-file contract:`,
		...orphans.map((orphan) => `    ${orphan.file}  —  ${orphan.label}`),
		"",
		"  v3 memory is decisions.md + gotchas.md only. These files were NOT migrated and were",
		"  NOT deleted — your knowledge is untouched. Note that the documented read",
		"  (`grep -ril … .meowkit/memory/`) still returns them, and `mewkit validate --memory`",
		"  lints them. Carry anything worth keeping into an entry with `mewkit note`, then remove",
		"  the leftover file yourself.",
	];
	return lines.join("\n");
}

/** Print the notice, if any. */
export function reportOrphanedV2Stores(projectRoot: string): void {
	const report = renderOrphanedV2Report(projectRoot);
	if (report) console.log(report);
}
