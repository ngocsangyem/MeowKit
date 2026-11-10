// Keeping a verified artifact so a later install needs no network.
//
// The store lives under the project-local cache, per version. It is the SAME
// cache the install already keeps the kit's own bytes in — there is one cache of
// kit bytes per project and this adds a subdirectory to it, not a second cache.
// A home-directory store would be shared by every project on the machine, so one
// project's download would sit where another project's deletion decisions are
// checked against, and kit versions are per-project anyway, which makes a
// single-version-per-machine store the wrong shape.
//
// The cost of that choice, stated rather than discovered: there is no
// cross-project download reuse, so an offline install works only in a project
// that has installed at least once. A project that has never installed and has
// no network is served by pointing the release lookup at a local directory.
//
// What comes OUT of the store is re-verified by the caller. A cached file is a
// local file; it is not trusted more for being local, and the attacker who can
// write a project's cache is exactly the attacker a digest check is for.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { KIT_MANIFEST_FILENAME, KIT_SIGNATURE_FILENAME } from "./kit-manifest.js";
import { artifactStoreDir } from "./kit-quarantine.js";
import type { KitArtifactBytes } from "./verify-kit-artifact.js";

const ARTIFACT_FILENAME = "kit.tar.gz";

/** Whether the store holds all three files for a version. */
export function hasStoredArtifact(root: string, version: string): boolean {
	const dir = artifactStoreDir(root, version);
	return [ARTIFACT_FILENAME, KIT_MANIFEST_FILENAME, KIT_SIGNATURE_FILENAME].every((name) =>
		existsSync(join(dir, name)),
	);
}

/** Read the three files for a version, or null when the store lacks any of them. */
export function readStoredArtifact(root: string, version: string): KitArtifactBytes | null {
	if (!hasStoredArtifact(root, version)) return null;
	const dir = artifactStoreDir(root, version);
	return {
		artifact: readFileSync(join(dir, ARTIFACT_FILENAME)),
		manifestBytes: readFileSync(join(dir, KIT_MANIFEST_FILENAME)),
		signature: readFileSync(join(dir, KIT_SIGNATURE_FILENAME), "utf-8"),
	};
}

/**
 * Store a verified artifact.
 *
 * The signature is written LAST, and `hasStoredArtifact` requires all three, so
 * an interrupted write leaves a store that reports itself absent rather than one
 * that reports itself present and then fails verification — the second looks
 * like tampering to whoever reads the message.
 */
export function storeArtifact(root: string, version: string, bytes: KitArtifactBytes): void {
	const dir = artifactStoreDir(root, version);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, ARTIFACT_FILENAME), bytes.artifact);
	writeFileSync(join(dir, KIT_MANIFEST_FILENAME), bytes.manifestBytes);
	writeFileSync(join(dir, KIT_SIGNATURE_FILENAME), bytes.signature ?? "", "utf-8");
}
