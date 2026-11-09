// Writing the superseded per-file checksum baseline, for fixtures that need a
// project in the shape the current CLI no longer produces.
//
// The product code has no writer for this file any more — that is the point of
// retiring it — so the fixtures that exercise the carry-forward path need their
// own. Keeping it here rather than in the product keeps "nothing writes it" true
// of the shipped tree while still letting a test build the project a user
// upgrading from an older install actually has.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildManifest, LEGACY_CHECKSUM_MANIFEST_FILENAME } from "../../src/core/compute-checksums.js";
import type { Manifest } from "../../src/core/compute-checksums.js";
import { buildInstallMetadata } from "../../src/core/install-metadata.js";
import { writeInstallMetadata } from "../../src/core/install-metadata-writer.js";

/** Write the superseded baseline for `claudeDir`, built from what is on disk. */
export function writeSupersededBaseline(claudeDir: string, manifest?: Manifest): Manifest {
	const content = manifest ?? buildManifest(claudeDir);
	writeFileSync(
		join(claudeDir, LEGACY_CHECKSUM_MANIFEST_FILENAME),
		`${JSON.stringify(content, null, 2)}\n`,
		"utf-8",
	);
	return content;
}

export { LEGACY_CHECKSUM_MANIFEST_FILENAME };

/**
 * Seed a project with the CANONICAL ownership record built from what is on disk,
 * which is the shape a project installed by the current CLI has.
 *
 * Fixtures used to seed the superseded file for this, because it was the only
 * baseline the install path read. Now there is one record, so a fixture that
 * wants "a project with a prior install" writes that one.
 */
export async function seedCanonicalBaseline(root: string, version = "2.0.0"): Promise<void> {
	const claudeDir = join(root, ".claude");
	const meta = buildInstallMetadata(claudeDir, { version });
	await writeInstallMetadata(root, meta);
}
