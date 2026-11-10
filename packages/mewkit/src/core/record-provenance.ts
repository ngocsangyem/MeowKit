// Recording what produced an install, after the install has produced it.
//
// Written as a separate pass rather than threaded through the install because
// the two facts come from different places: the file list is built by hashing
// what landed on disk, while the target, the delivery and the origin are
// properties of the command that ran. Composing them at the end keeps the
// hashing path unaware of flags, and keeps `version` and `scope` exactly where
// every existing reader already finds them.
//
// A project with no record is left alone. Provenance describes an install; there
// is nothing to describe when nothing was installed, and writing a record for an
// absent install would make the file claim one exists.
import { existsSync } from "node:fs";
import { join } from "node:path";

import type { InstallDelivery, InstallTarget } from "../commands/init-target-delivery.js";
import { TARGET_SHAPES } from "../emit/target-shape.js";
import { CorruptInstallMetadataError, readInstallMetadata } from "./install-metadata.js";
import type { InstallMetadata, InstallOrigin } from "./install-metadata.js";
import { writeInstallMetadata } from "./install-metadata-writer.js";

export interface ProvenanceFacts {
	kitVersion: string;
	cliVersion: string;
	target: InstallTarget;
	delivery: InstallDelivery;
	origin: InstallOrigin;
}

/**
 * How the content of this run arrived, for the record. One answer for every
 * entry point: an install and the upgrade after it must not describe the same
 * source differently.
 *
 * A configured local release directory is its own origin rather than being
 * folded into one of the download paths: it is already-extracted content with no
 * archive to verify, and calling it a verified artifact would be a false claim
 * in the one field a user checks to find out whether verification happened.
 */
export function installOrigin(offline: boolean): InstallOrigin {
	if (offline) return "local-cache";
	const configured = process.env.MEOWKIT_RELEASE_SOURCE;
	return configured !== undefined && configured.trim() !== "" ? "local-release-dir" : "verified-artifact";
}

/**
 * Attach provenance to this project's install record.
 *
 * Returns whether anything was written, so a caller can report honestly instead
 * of printing a success line for a no-op. A corrupt record is left untouched: the
 * repair for that is the upgrade that rebuilds it, and rewriting it here would
 * destroy whatever a human might still recover from it.
 */
export async function recordProvenance(root: string, facts: ProvenanceFacts): Promise<boolean> {
	let meta;
	try {
		meta = readInstallMetadata(join(root, ".claude")).meta;
	} catch (error) {
		if (error instanceof CorruptInstallMetadataError) return false;
		throw error;
	}
	// A provider-only install (an external target, with no `.claude/`) still has an
	// install to describe, so it gets a record rather than being treated as absent.
	// Its `files` list stays empty on purpose: per-file ownership for those targets
	// lives in the provider ledger, and duplicating it here would be the second
	// ownership answer the single record exists to avoid.
	//
	// "Has an install" is decided by the target's OWN declared writes, not by the
	// presence of `.claude/`. A directory with neither gets no record: a file that
	// claims an install exists where none does is worse than no file, because every
	// later reader believes it.
	if (meta === null && !TARGET_SHAPES[facts.target].writes.some((rel) => existsSync(join(root, rel)))) {
		return false;
	}
	const base: InstallMetadata =
		meta ??
		{
			schemaVersion: "1.0",
			tool: "meowkit",
			version: facts.kitVersion,
			installedAt: new Date().toISOString(),
			files: [],
		};
	await writeInstallMetadata(root, { ...base, provenance: facts });
	return true;
}
