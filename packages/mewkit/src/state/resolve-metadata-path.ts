// Where the per-install metadata baseline lives. Canonical is `.meowkit/metadata.json`,
// beside the rest of the runtime-neutral state: this file records what THIS install put on
// disk and whether the user has since edited any of it. That is MeowKit's own bookkeeping,
// not a provider artifact, and it is already excluded from release checksums for the same
// reason.
//
// The stakes here are higher than for the config move. This file is the baseline
// `smart-update` compares against to decide whether a file is user-edited. If a reader
// cannot find it, every file looks unmodified and an upgrade overwrites local edits in
// silence. So reads fall back to the pre-move location, and the writer migrates rather than
// forks — a project must never end up holding two baselines, because then upgrade behavior
// depends on read order.
import { existsSync } from "node:fs";
import { join } from "node:path";

export const METADATA_BASENAME = "metadata.json";
export const METADATA_LOCK_BASENAME = ".metadata.lock";
export const LEGACY_METADATA_REL = join(".claude", METADATA_BASENAME);

/** Canonical write target: `<root>/.meowkit/metadata.json`. */
export function metadataWritePath(projectRoot: string): string {
	return join(projectRoot, ".meowkit", METADATA_BASENAME);
}

/**
 * The lock guarding the canonical file. It lives beside its target on purpose: a lock in a
 * different directory from the file it guards serializes nothing.
 */
export function metadataLockPath(projectRoot: string): string {
	return join(projectRoot, ".meowkit", METADATA_LOCK_BASENAME);
}

/** The pre-move location, still read so upgrading the CLI does not orphan an install. */
export function legacyMetadataPath(projectRoot: string): string {
	return join(projectRoot, LEGACY_METADATA_REL);
}

/** The metadata a reader should use: canonical when present, else pre-move, else canonical. */
export function resolveMetadataPath(projectRoot: string): string {
	const canonical = metadataWritePath(projectRoot);
	if (existsSync(canonical)) return canonical;
	const legacy = legacyMetadataPath(projectRoot);
	if (existsSync(legacy)) return legacy;
	return canonical; // absent either way — report against the path we would create
}

/** True when the project is still served by the pre-move metadata location. */
export function usingLegacyMetadata(projectRoot: string): boolean {
	return !existsSync(metadataWritePath(projectRoot)) && existsSync(legacyMetadataPath(projectRoot));
}
