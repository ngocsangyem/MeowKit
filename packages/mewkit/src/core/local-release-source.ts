// A directory standing in for a downloaded release, so an install can be driven
// with no network at all.
//
// Why this exists: the kit is published as a GitHub release asset and the CLI
// package ships no kit content, so every `init` and `upgrade` reaches the
// network. That makes the install path the one part of the product no test can
// run end to end, which is exactly the part where "what did we lay down, and
// what do we now own" is decided. Pointing the release lookup at a local
// directory closes that gap without a second code path: the directory is
// treated as an already-extracted release and everything downstream is
// untouched.
//
// The directory is COPIED rather than used in place, because the caller cleans
// up what the download produced and a fixture must survive its own use.
import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** File inside the source directory carrying the version it stands in for. */
export const VERSION_FILE = "release-version.txt";

const FALLBACK_VERSION = "0.0.0-local";

/** The configured directory, when it is set and really is a directory. */
export function localReleaseDir(): string | null {
	const configured = process.env.MEOWKIT_RELEASE_SOURCE;
	if (configured === undefined || configured.trim() === "") return null;
	const dir = configured.trim();
	if (!existsSync(dir) || !statSync(dir).isDirectory()) {
		throw new Error(`MEOWKIT_RELEASE_SOURCE is set to ${dir}, which is not a directory`);
	}
	return dir;
}

/** The version the directory claims, from its own version file. */
export function localReleaseVersion(dir: string): string {
	const file = join(dir, VERSION_FILE);
	if (!existsSync(file)) return FALLBACK_VERSION;
	const text = readFileSync(file, "utf8").trim();
	return text === "" ? FALLBACK_VERSION : text.replace(/^v/, "");
}

/**
 * Copy the source directory to a fresh temp directory and return it, in the
 * shape `downloadRelease` returns: the root of an extracted release.
 */
export function materializeLocalRelease(dir: string, version: string): string {
	const tempDir = join(tmpdir(), `meowkit-release-${version}-${Date.now()}`);
	mkdirSync(tempDir, { recursive: true });
	const extractDir = join(tempDir, "extracted");
	cpSync(dir, extractDir, { recursive: true, dereference: true });
	return extractDir;
}
