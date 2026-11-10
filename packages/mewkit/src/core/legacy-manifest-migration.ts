// Carrying a pre-metadata install's ownership baseline forward, once, and then
// retiring the file that held it.
//
// Two files used to answer "which paths does this install own, and what did they
// look like as shipped" — a per-file checksum manifest under the provider
// directory, and the canonical metadata record. Two answers to one question is
// the defect: whichever is read first wins, and nothing detects that they
// disagree. So there is now one record, and this module exists only to get the
// older installs there.
//
// Deleting the old file outright was not an option. It is the ONLY baseline a
// project that never upgraded has, and an install with no baseline is one where
// removal refuses everything, because nothing can establish what the kit put
// there. So the file is read one last time, its entries are carried into the
// canonical record, and only then is it removed — and a diagnostic run before
// that upgrade reports the project as pending rather than as unowned.
//
// Anything that could not be carried is named. A silent partial carry would
// leave paths the project owned looking user-authored, which is the shape of
// bug that shows up months later as "the uninstall left files behind".
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { LEGACY_CHECKSUM_MANIFEST_FILENAME } from "./compute-checksums.js";
import type { FileLayer, ManifestOwner } from "./compute-checksums.js";
import type { InstallFileEntry } from "./install-metadata.js";
import { readInstallMetadata } from "./install-metadata.js";
import { writeInstallMetadata } from "./install-metadata-writer.js";

interface LegacyEntry {
	sha256?: unknown;
	layer?: unknown;
	owner?: unknown;
	installedVersion?: unknown;
	baseChecksum?: unknown;
	installedAt?: unknown;
}

interface LegacyManifest {
	generatedAt?: unknown;
	checksums?: Record<string, LegacyEntry>;
}

const LAYERS = new Set<FileLayer>(["core", "skill", "user"]);
const OWNERS = new Set<ManifestOwner>(["meowkit", "user", "meowkit-modified"]);

const legacyManifestPath = (claudeDir: string): string => join(claudeDir, LEGACY_CHECKSUM_MANIFEST_FILENAME);

/** Whether this project still carries the superseded baseline. */
export const hasLegacyManifest = (claudeDir: string): boolean => existsSync(legacyManifestPath(claudeDir));

/** Canonical entry order, so a carried baseline and a merged one sort alike. */
const byPathAscending = (a: InstallFileEntry, b: InstallFileEntry): number =>
	a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

export interface CarriedBaseline {
	entries: InstallFileEntry[];
	/** Paths present in the old file that could not be carried, with the reason. */
	uncarried: Array<{ path: string; reason: string }>;
	/** When the old file recorded itself as generated, or "" when it did not. */
	generatedAt: string;
}

/**
 * Project the superseded baseline onto canonical entries.
 *
 * The old `sha256` becomes BOTH the current checksum and the as-shipped one. The
 * old format recorded no separate as-shipped value for most entries, and the
 * alternative — leaving it empty — would make every carried path compare as
 * modified on the next upgrade, which is the opposite of preserving a baseline.
 */
export function carryLegacyBaseline(claudeDir: string): CarriedBaseline | null {
	const file = legacyManifestPath(claudeDir);
	if (!existsSync(file)) return null;
	let parsed: LegacyManifest;
	try {
		parsed = JSON.parse(readFileSync(file, "utf-8")) as LegacyManifest;
	} catch {
		return {
			entries: [],
			uncarried: [{ path: LEGACY_CHECKSUM_MANIFEST_FILENAME, reason: "unreadable" }],
			generatedAt: "",
		};
	}
	const checksums = parsed.checksums;
	if (typeof checksums !== "object" || checksums === null) {
		return {
			entries: [],
			uncarried: [{ path: LEGACY_CHECKSUM_MANIFEST_FILENAME, reason: "no checksum table" }],
			generatedAt: "",
		};
	}

	const entries: InstallFileEntry[] = [];
	const uncarried: Array<{ path: string; reason: string }> = [];
	for (const [path, raw] of Object.entries(checksums)) {
		const layer = typeof raw.layer === "string" && LAYERS.has(raw.layer as FileLayer) ? (raw.layer as FileLayer) : null;
		if (typeof raw.sha256 !== "string" || raw.sha256 === "") {
			uncarried.push({ path, reason: "no recorded checksum" });
			continue;
		}
		if (layer === null) {
			uncarried.push({ path, reason: "no recognized layer" });
			continue;
		}
		const owner =
			typeof raw.owner === "string" && OWNERS.has(raw.owner as ManifestOwner)
				? (raw.owner as ManifestOwner)
				: layer === "user"
					? "user"
					: "meowkit";
		const entry: InstallFileEntry = {
			path,
			owner,
			layer,
			checksum: raw.sha256,
			baseChecksum: typeof raw.baseChecksum === "string" ? raw.baseChecksum : raw.sha256,
		};
		if (typeof raw.installedVersion === "string") entry.installedVersion = raw.installedVersion;
		if (typeof raw.installedAt === "string") entry.installedAt = raw.installedAt;
		entries.push(entry);
	}
	entries.sort(byPathAscending);
	return { entries, uncarried, generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : "" };
}

/**
 * Remove the superseded file. Called only after the canonical record has been
 * written, so an interrupted migration leaves a project with its old baseline
 * rather than with none.
 */
function removeLegacyManifest(claudeDir: string): void {
	rmSync(legacyManifestPath(claudeDir), { force: true });
}

/** What a diagnostic says about a project that has not migrated yet. */
export function migrationPendingMessage(): string {
	return [
		`This project's ownership baseline is still the superseded ${LEGACY_CHECKSUM_MANIFEST_FILENAME},`,
		"so it is owned but not yet recorded in the canonical metadata the current CLI reads.",
		"Run `mewkit upgrade` to carry the baseline forward; it snapshots first and reports anything it could not carry.",
	].join(" ");
}

export interface MigrationOutcome {
	carried: number;
	uncarried: Array<{ path: string; reason: string }>;
}

/**
 * Carry the superseded baseline into the canonical record, then retire it.
 *
 * Returns null when there is nothing to migrate, so a caller can run this
 * unconditionally on every upgrade without first asking whether it applies.
 *
 * Existing canonical entries win over carried ones. A project that has both
 * files has already been written by a current CLI, and that record was built by
 * hashing the tree rather than by trusting a file — so the older one cannot be
 * allowed to overwrite it, only to fill gaps.
 */
export async function migrateLegacyBaseline(projectRoot: string): Promise<MigrationOutcome | null> {
	const claudeDir = join(projectRoot, ".claude");
	const carried = carryLegacyBaseline(claudeDir);
	if (carried === null) return null;

	const existing = readInstallMetadata(claudeDir);
	const byPath = new Map<string, InstallFileEntry>();
	for (const entry of carried.entries) byPath.set(entry.path, entry);
	for (const entry of existing.meta?.files ?? []) byPath.set(entry.path, entry);

	const files = [...byPath.values()].sort(byPathAscending);
	await writeInstallMetadata(projectRoot, {
		schemaVersion: "1.0",
		tool: existing.meta?.tool ?? "meowkit",
		version: existing.meta?.version ?? "",
		installedAt: existing.meta?.installedAt ?? carried.generatedAt,
		files,
		...(existing.meta?.scope === undefined ? {} : { scope: existing.meta.scope }),
		...(existing.meta?.profile === undefined ? {} : { profile: existing.meta.profile }),
		...(existing.meta?.packs === undefined ? {} : { packs: existing.meta.packs }),
		...(existing.meta?.provenance === undefined ? {} : { provenance: existing.meta.provenance }),
		...(existing.meta?.settings === undefined ? {} : { settings: existing.meta.settings }),
	});
	// Only after the canonical record is published: an interrupted run then leaves
	// the project with its old baseline rather than with none at all.
	removeLegacyManifest(claudeDir);
	return { carried: carried.entries.length, uncarried: carried.uncarried };
}
