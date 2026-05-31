// Shared helpers for the `pack` command: installed-state reads, settings.json
// hook-reference extraction (so remove never breaks an append-only invocation),
// release selection, and crash-safe metadata rebuild.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	availablePacks,
	BASE_PACK,
	buildInstallMetadata,
	CorruptInstallMetadataError,
	fetchReleases,
	hashFile,
	indexByPath,
	readInstallMetadata,
	resolvePacksDetailed,
	type InstallFileEntry,
	type InstallMetadata,
	type PackManifest,
	type ReleaseInfo,
} from "../core/index.js";
import { writeInstallMetadata } from "../core/install-metadata-writer.js";

export interface InstalledState {
	meta: InstallMetadata | null;
	/** Installed pack names (incl. base). `undefined` packs ⇒ full ⇒ every pack. */
	installedPacks: string[];
	/** Whether this is a full/legacy install (packs sentinel undefined). */
	isFull: boolean;
}

/** Read installed packs; a corrupt metadata.json surfaces as a thrown error to the caller. */
export function readInstalledState(claudeDir: string, manifest: PackManifest): InstalledState {
	const { meta } = readInstallMetadata(claudeDir);
	const declared = meta?.packs;
	const isFull = !declared;
	const installedPacks = declared
		? [...new Set([BASE_PACK, ...declared])]
		: [BASE_PACK, ...availablePacks(manifest)];
	return { meta, installedPacks, isFull };
}

/** Extract every `.claude/`-relative path referenced inside settings.json command strings. */
export function settingsReferencedPaths(claudeDir: string): Set<string> {
	const out = new Set<string>();
	const sp = join(claudeDir, "settings.json");
	if (!existsSync(sp)) return out;
	let txt: string;
	try {
		txt = readFileSync(sp, "utf-8");
	} catch {
		return out;
	}
	const re = /\.claude\/([A-Za-z0-9_./-]+)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(txt)) !== null) out.add(m[1]);
	return out;
}

/** Pick the release matching the installed version, falling back to latest stable. */
export async function pickInstallRelease(version: string | undefined): Promise<ReleaseInfo | null> {
	const releases = await fetchReleases();
	if (version) {
		const exact = releases.find((r) => r.version === version);
		if (exact) return exact;
	}
	return releases.find((r) => !r.isBeta) ?? releases[0] ?? null;
}

/**
 * Rebuild canonical metadata by scanning the current `.claude/` and recording the
 * next pack list. Full rebuild (not a surgical `files` patch) so stale entries
 * can't corrupt a future upgrade hash-compare. `priorEntriesByPath` preserves the
 * as-shipped `baseChecksum` for surviving files.
 */
export async function rebuildMetadata(
	claudeDir: string,
	prior: InstallMetadata | null,
	nextPacks: string[] | undefined,
): Promise<void> {
	const meta = buildInstallMetadata(claudeDir, {
		version: prior?.version ?? "unknown",
		priorEntriesByPath: indexByPath(prior?.files ?? []),
		scope: prior?.scope ?? "local",
		mergedSettings: prior?.settings?.merged,
		profile: prior?.profile,
		packs: nextPacks,
	});
	await writeInstallMetadata(claudeDir, meta);
}

export interface RemovalPlan {
	/** Pristine, pack-exclusive, kit-owned paths safe to delete. */
	deletable: string[];
	/** Paths kept because shared/base/settings-referenced or user-modified. */
	preserved: string[];
}

/**
 * Decide which files a `pack remove` may delete. A file is deletable only when it
 * is in a target pack's members AND NOT in base, AND NOT in any surviving installed
 * pack, AND NOT referenced by settings.json, AND it is kit-owned + pristine on disk.
 * Membership is resolved from the on-disk inventory, so dual-homed artifacts and
 * base-covered hooks survive automatically.
 */
export function computeRemovablePaths(
	claudeDir: string,
	manifest: PackManifest,
	installedNonBase: string[],
	requested: string[],
	metaFiles: InstallFileEntry[],
): RemovalPlan {
	const detailed = resolvePacksDetailed(claudeDir, manifest, installedNonBase);
	const removeSet = new Set(requested);
	const surviving = installedNonBase.filter((n) => !removeSet.has(n));

	const keep = new Set<string>(detailed.packMembership.get(BASE_PACK) ?? []);
	for (const sp of surviving) for (const pth of detailed.packMembership.get(sp) ?? []) keep.add(pth);
	for (const ref of settingsReferencedPaths(claudeDir)) keep.add(ref);

	const byPath = indexByPath(metaFiles);
	const deletable: string[] = [];
	const preserved: string[] = [];
	for (const target of requested) {
		for (const pth of detailed.packMembership.get(target) ?? []) {
			if (keep.has(pth)) {
				// shared with base/another installed pack, or settings.json-referenced
				preserved.push(pth);
				continue;
			}
			const dest = join(claudeDir, pth);
			if (!existsSync(dest)) continue;
			const entry = byPath[pth];
			if (!entry || entry.owner !== "meowkit" || hashFile(dest) !== entry.checksum) {
				preserved.push(pth);
				continue;
			}
			deletable.push(pth);
		}
	}
	return { deletable, preserved };
}

export { CorruptInstallMetadataError };
