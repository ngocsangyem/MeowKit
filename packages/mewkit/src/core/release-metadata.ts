// CLI-side reader for the release-metadata carrier: `release-manifest.json` at
// the extracted release root. This is the single parser for that file — it
// supplies the installed kit version, per-file source timestamps, and the
// optional maintainer-curated `deletions[]` list.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Manifest } from "./compute-checksums.js";

export const RELEASE_MANIFEST_FILENAME = "release-manifest.json";

export const ReleaseFileEntrySchema = z.object({
	path: z.string(),
	checksum: z.string(),
	size: z.number().optional(),
	lastModified: z.string().optional(),
});
export type ReleaseFileEntry = z.infer<typeof ReleaseFileEntrySchema>;

export const ReleaseManifestSchema = z.object({
	version: z.string(),
	generatedAt: z.string(),
	files: z.array(ReleaseFileEntrySchema),
	deletions: z.array(z.string()).default([]),
});
export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;

/** Thrown when `release-manifest.json` is present but does not match the schema. */
export class CorruptReleaseManifestError extends Error {
	constructor(public readonly detail: string) {
		super(`Corrupt release-manifest.json: ${detail}`);
		this.name = "CorruptReleaseManifestError";
	}
}

/**
 * Read `release-manifest.json` from an extracted release root.
 * Returns null when the file is absent; throws on a present-but-corrupt manifest.
 */
export function readReleaseMetadata(sourceDir: string): ReleaseManifest | null {
	const manifestPath = join(sourceDir, RELEASE_MANIFEST_FILENAME);
	if (!existsSync(manifestPath)) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(manifestPath, "utf-8"));
	} catch (err) {
		throw new CorruptReleaseManifestError((err as Error).message);
	}
	const result = ReleaseManifestSchema.safeParse(parsed);
	if (!result.success) throw new CorruptReleaseManifestError(result.error.message);
	return result.data;
}

/** Map each release file path to its source commit timestamp (when recorded). */
export function mapPathToLastModified(release: ReleaseManifest | null): Record<string, string> {
	const out: Record<string, string> = {};
	for (const f of release?.files ?? []) {
		if (f.lastModified) out[f.path] = f.lastModified;
	}
	return out;
}

/**
 * Map each release file path to its incoming payload checksum. Feeds
 * `buildInstallMetadata`'s `expectedChecksums` so a byte-identical forward copy of
 * a file that changed between releases is recognized as toolkit-owned rather than
 * mislabeled `meowkit-modified`.
 */
export function mapPathToChecksum(release: ReleaseManifest | null): Record<string, string> {
	const out: Record<string, string> = {};
	for (const f of release?.files ?? []) {
		out[f.path] = f.checksum;
	}
	return out;
}

/**
 * Project a release manifest onto the `Manifest` shape `findOrphans` consumes —
 * only the checksum keys matter for orphan detection.
 */
export function toOrphanManifest(release: ReleaseManifest): Manifest {
	const checksums: Manifest["checksums"] = {};
	for (const f of release.files) {
		checksums[f.path] = { sha256: f.checksum, layer: "core" };
	}
	return { version: release.version, generatedAt: release.generatedAt, checksums };
}
