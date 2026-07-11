// Canonical installed-metadata model for a MeowKit install under `.claude/`.
// Declares the Zod schema, a compatibility reader that recognizes the new file,
// the legacy checksum manifest, and the old version-only metadata, and a builder
// that labels per-file ownership (meowkit / user / meowkit-modified) against the
// prior installed state. The locked atomic writer lives in install-metadata-writer.ts.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { collectFiles, hashFile, classifyLayer, readManifest } from "./compute-checksums.js";
import type { Manifest } from "./compute-checksums.js";

export const INSTALL_METADATA_FILENAME = "metadata.json";

export const InstallFileEntrySchema = z.object({
	path: z.string(),
	owner: z.enum(["meowkit", "user", "meowkit-modified"]),
	layer: z.enum(["core", "skill", "user"]),
	checksum: z.string(),
	baseChecksum: z.string(),
	installedVersion: z.string().optional(),
	sourceTimestamp: z.string().optional(),
	installedAt: z.string().optional(),
});
export type InstallFileEntry = z.infer<typeof InstallFileEntrySchema>;

export const InstallMetadataSchema = z.object({
	schemaVersion: z.literal("1.0"),
	tool: z.string().default("meowkit"),
	version: z.string(),
	scope: z.string().optional(),
	installedAt: z.string(),
	files: z.array(InstallFileEntrySchema),
	settings: z.object({ merged: z.array(z.string()) }).optional(),
	/** Installed profile name ("full" for a whole-tree install). */
	profile: z.string().optional(),
	/**
	 * Resolved pack list for a partial install. Absent/undefined is the "full,
	 * auto-adopt new packs on upgrade" sentinel — never a frozen all-packs list.
	 */
	packs: z.array(z.string()).optional(),
});
export type InstallMetadata = z.infer<typeof InstallMetadataSchema>;

export type MetadataSource = "new" | "legacy-manifest" | "legacy-metadata" | "none";
export interface ReadInstallMetadataResult {
	source: MetadataSource;
	meta: InstallMetadata | null;
}

/** Thrown when a canonical metadata.json carries `schemaVersion` but fails validation. */
export class CorruptInstallMetadataError extends Error {
	constructor(public readonly detail: string) {
		super(`Corrupt .claude/metadata.json: ${detail}`);
		this.name = "CorruptInstallMetadataError";
	}
}

/** Index a file-entry list by its `.claude/`-relative path. */
export function indexByPath(entries: InstallFileEntry[]): Record<string, InstallFileEntry> {
	const out: Record<string, InstallFileEntry> = {};
	for (const e of entries) out[e.path] = e;
	return out;
}

/**
 * Read installed metadata with explicit source precedence:
 *   new (schemaVersion) > legacy checksum manifest > version-only metadata > none.
 * The legacy-manifest branch never trusts `Manifest.version` (hardcoded upstream);
 * it sources the version from a sibling version-only metadata.json when present.
 * Throws CorruptInstallMetadataError when a schemaVersion-bearing file fails Zod.
 */
export function readInstallMetadata(claudeDir: string): ReadInstallMetadataResult {
	const metadataPath = join(claudeDir, INSTALL_METADATA_FILENAME);
	let legacyMetadataVersion: string | null = null;

	if (existsSync(metadataPath)) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(readFileSync(metadataPath, "utf-8"));
		} catch {
			// mid-write or garbage; `parsed` stays undefined and we fall through.
		}
		if (typeof parsed === "object" && parsed !== null) {
			const obj = parsed as Record<string, unknown>;
			if ("schemaVersion" in obj) {
				const result = InstallMetadataSchema.safeParse(parsed);
				if (!result.success) throw new CorruptInstallMetadataError(result.error.message);
				return { source: "new", meta: result.data };
			}
			if (typeof obj.version === "string") legacyMetadataVersion = obj.version;
		}
	}

	const legacyManifest = readManifest(claudeDir);
	if (legacyManifest !== null) {
		return { source: "legacy-manifest", meta: mapLegacyManifest(legacyManifest, legacyMetadataVersion) };
	}

	if (legacyMetadataVersion !== null) {
		return {
			source: "legacy-metadata",
			meta: {
				schemaVersion: "1.0",
				tool: "meowkit",
				version: legacyMetadataVersion,
				installedAt: "",
				files: [],
			},
		};
	}

	return { source: "none", meta: null };
}

/**
 * Read ONLY the legacy `meowkit.manifest.json` as canonical-shaped metadata,
 * or null when absent. Used as a recovery path when the canonical metadata.json
 * is present but corrupt, so user-edit protection still has a prior baseline.
 */
export function readLegacyManifestMetadata(claudeDir: string): InstallMetadata | null {
	const manifest = readManifest(claudeDir);
	return manifest === null ? null : mapLegacyManifest(manifest, null);
}

/**
 * Project a legacy `meowkit.manifest.json` onto the canonical shape. The legacy
 * `sha256` maps to BOTH `checksum` and `baseChecksum` so the user-edit comparison
 * stays equivalent. Version comes from a sibling version-only metadata.json or "".
 */
function mapLegacyManifest(manifest: Manifest, legacyVersion: string | null): InstallMetadata {
	const files: InstallFileEntry[] = [];
	for (const [path, entry] of Object.entries(manifest.checksums)) {
		files.push({
			path,
			owner: entry.owner ?? (entry.layer === "user" ? "user" : "meowkit"),
			layer: entry.layer,
			checksum: entry.sha256,
			baseChecksum: entry.baseChecksum ?? entry.sha256,
			installedVersion: entry.installedVersion,
			installedAt: entry.installedAt,
		});
	}
	return {
		schemaVersion: "1.0",
		tool: "meowkit",
		version: legacyVersion ?? "",
		installedAt: manifest.generatedAt,
		files,
	};
}

export interface BuildInstallMetadataOptions {
	/** Installed kit version (from release-manifest). */
	version: string;
	/** Per-path source commit timestamp (release-manifest `lastModified`). */
	sourceTimestamps?: Record<string, string>;
	/**
	 * Incoming release payload hash per `.claude/`-relative path (release-manifest
	 * `checksum`). When a kit file's disk hash equals its incoming payload hash, it
	 * is a clean forward copy of the new release — toolkit-owned, and its as-shipped
	 * `baseChecksum` advances to the new payload. Absent for flows with no incoming
	 * release (e.g. pack rebuild), which fall back to prior-state comparison.
	 */
	expectedChecksums?: Record<string, string>;
	/** Prior installed entries, indexed by `.claude/`-relative path. */
	priorEntriesByPath?: Record<string, InstallFileEntry>;
	/** Optional install scope marker (e.g. "local"). */
	scope?: string;
	/** settings.json files merged this install. */
	mergedSettings?: string[];
	/** Installed profile name (recorded verbatim; "full" for whole-tree installs). */
	profile?: string;
	/** Resolved pack list for a partial install; omit for full/legacy (sentinel). */
	packs?: string[];
}

/**
 * Scan an installed `.claude/` and build canonical metadata. Ownership for kit
 * (core/skill) files is computed with this precedence:
 *   1. Disk hash equals the incoming release payload (`expectedChecksums`) — a
 *      clean forward copy. Labeled `meowkit`, and `baseChecksum` ADVANCES to the
 *      new payload so the next upgrade compares against the current release, not
 *      a stale one. This is what stops a byte-identical forward copy from being
 *      mislabeled `meowkit-modified` when the file changed between releases.
 *   2. No prior entry — a fresh file. When the incoming payload is known and disk
 *      differs from it, the file was edited after copy: `meowkit-modified` with
 *      `baseChecksum` set to the as-shipped payload. Otherwise `meowkit`.
 *   3. Prior entry present — compare disk to the prior `baseChecksum`: unchanged
 *      is `meowkit`, otherwise `meowkit-modified`. `baseChecksum` is preserved.
 * With no `expectedChecksums`, behavior is identical to the prior-state-only model.
 */
export function buildInstallMetadata(claudeDir: string, opts: BuildInstallMetadataOptions): InstallMetadata {
	const installedAt = new Date().toISOString();
	const prior = opts.priorEntriesByPath ?? {};
	const timestamps = opts.sourceTimestamps ?? {};
	const expected = opts.expectedChecksums ?? {};
	// Release-manifest-derived maps (expected/timestamps) key on forward-slash paths
	// (generate-release-manifest.cjs normalizes separators); `collectFiles` yields
	// native separators on Windows. Look those maps up by a normalized key so the
	// forward-copy recognition is not a silent no-op for nested paths on Windows.
	// `prior` stays keyed by the raw relPath — its entries come from our own metadata,
	// written with the same native separators.
	const mergedSet = new Set((opts.mergedSettings ?? []).map((p) => p.replace(/\\/g, "/")));
	const files: InstallFileEntry[] = [];

	for (const relPath of collectFiles(claudeDir, claudeDir)) {
		const diskHash = hashFile(join(claudeDir, relPath));
		const layer = classifyLayer(relPath);
		const priorEntry = prior[relPath];
		const normKey = relPath.replace(/\\/g, "/");
		const expectedHash = expected[normKey];

		let owner: InstallFileEntry["owner"];
		let baseChecksum: string;
		if (layer === "user") {
			owner = "user";
			baseChecksum = priorEntry ? priorEntry.baseChecksum : diskHash;
		} else if (expectedHash !== undefined && diskHash === expectedHash) {
			// Clean forward copy of the incoming payload — advance the as-shipped baseline.
			owner = "meowkit";
			baseChecksum = diskHash;
		} else if (!priorEntry) {
			if (expectedHash !== undefined && !mergedSet.has(normKey)) {
				// Incoming payload is known and disk differs — edited after copy.
				owner = "meowkit-modified";
				baseChecksum = expectedHash;
			} else {
				// A merged file (e.g. settings.json) legitimately differs from the shipped
				// payload — the merge is recorded in `meta.settings.merged`, not counted as
				// a local modification. Fresh files with no incoming hash also land here.
				owner = "meowkit";
				baseChecksum = diskHash;
			}
		} else {
			baseChecksum = priorEntry.baseChecksum;
			owner = diskHash === priorEntry.baseChecksum ? "meowkit" : "meowkit-modified";
		}

		const entry: InstallFileEntry = {
			path: relPath,
			owner,
			layer,
			checksum: diskHash,
			baseChecksum,
			installedVersion: opts.version,
			installedAt,
		};
		const sourceTimestamp = timestamps[normKey];
		if (sourceTimestamp) entry.sourceTimestamp = sourceTimestamp;
		files.push(entry);
	}

	files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

	const meta: InstallMetadata = {
		schemaVersion: "1.0",
		tool: "meowkit",
		version: opts.version,
		installedAt,
		files,
	};
	if (opts.scope) meta.scope = opts.scope;
	if (opts.mergedSettings && opts.mergedSettings.length > 0) meta.settings = { merged: opts.mergedSettings };
	if (opts.profile) meta.profile = opts.profile;
	if (opts.packs) meta.packs = opts.packs;
	return meta;
}
