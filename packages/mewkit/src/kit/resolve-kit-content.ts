// Deciding where one install's kit content comes from, and refusing rather than
// settling for less.
//
// Four origins, and the precedence between them is the whole point:
//
//   verified artifact  — taken whenever the release carries one
//   legacy release zip — taken ONLY when the release carries no artifact at all
//   local release dir  — an explicitly configured directory, so it wins outright
//   local cache        — `--offline`, re-verified exactly as a download would be
//
// An artifact that is PRESENT and fails a check is terminal. It does not fall
// back to the zip, even when the zip is there and valid, because that fallback
// would mean a tampered artifact silently downgrades the user to the unverified
// path the artifact exists to replace — which is the attack, not the recovery.
//
// The cost of the no-fallback rule, stated rather than discovered: a corrupt or
// mis-signed publish blocks every install of that version until a new release is
// cut. The diagnostic says so in those words, which is why the refusal leaves a
// record behind.
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { InstallOrigin } from "../core/install-metadata.js";
import { readStoredArtifact, storeArtifact } from "./kit-artifact-store.js";
import { offlineCacheMissError, offlineQuarantinedError } from "./kit-offline.js";
import { readVerificationFailure, recordVerificationFailure } from "./kit-quarantine.js";
import { KitVerificationError } from "./kit-refusal.js";
import { TRUSTED_KIT_KEYS } from "./trusted-keys.js";
import type { KitArtifactBytes } from "./verify-kit-artifact.js";
import { extractVerifiedArchive, verifyKitArtifact } from "./verify-kit-artifact.js";

export interface ResolvedKitContent {
	/** Directory holding the extracted release, in the shape the install expects. */
	sourceDir: string;
	origin: InstallOrigin;
}

/**
 * Verify the bytes, extract them into a fresh staging directory, and store them
 * for a later offline install.
 *
 * A refused attempt records the failure inside the project's quarantine before
 * re-throwing, so a later diagnostic can name the version and the failed check
 * with no network and no second fetch. That record is the only thing a refusal
 * writes, and it is not installable content.
 */
export async function installFromArtifact(
	root: string,
	version: string,
	bytes: KitArtifactBytes,
	origin: InstallOrigin,
	keys: readonly string[] = TRUSTED_KIT_KEYS,
): Promise<ResolvedKitContent> {
	try {
		const verified = verifyKitArtifact(bytes, version, keys);
		// Staging is created only AFTER every check has passed, so "nothing is
		// written outside quarantine on a refusal" is a consequence of the control
		// flow rather than something a cleanup step has to get right.
		const staging = await mkdtemp(join(tmpdir(), `meowkit-kit-${version}-`));
		await extractVerifiedArchive(verified, staging, version);
		if (origin !== "local-cache") storeArtifact(root, version, bytes);
		return { sourceDir: staging, origin };
	} catch (error) {
		if (error instanceof KitVerificationError) {
			recordVerificationFailure(root, version, error.check, error.subject);
		}
		throw error;
	}
}

/**
 * Serve an install from this project's cache alone, reaching no network.
 *
 * What comes out of the cache is put through the SAME checks a download gets. A
 * cached file is a local file; it is not trusted more for being local, and the
 * attacker who can write a project's cache is exactly the one a digest check is
 * for.
 */
export async function installOffline(
	root: string,
	version: string,
	keys: readonly string[] = TRUSTED_KIT_KEYS,
): Promise<ResolvedKitContent> {
	const refused = readVerificationFailure(root, version);
	if (refused !== null) throw offlineQuarantinedError(refused);
	const bytes = readStoredArtifact(root, version);
	if (bytes === null) throw offlineCacheMissError(version);
	return installFromArtifact(root, version, bytes, "local-cache", keys);
}
