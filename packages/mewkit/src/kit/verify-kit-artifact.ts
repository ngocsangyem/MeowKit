// Verify a kit artifact, then extract it. In that order, structurally.
//
// The order is a property of this module rather than a convention a caller is
// trusted to follow: `verifyKitArtifact` returns the archive contents, and
// `extractVerifiedArchive` is the only way to write them, so there is no path
// that reaches the filesystem without having gone through the checks. A comment
// saying "verify first" would be a claim; this is the shape.
//
// Six checks, in the order that makes a failure cheapest to explain:
//   1 signature over the manifest bytes — authenticates everything after it
//   2 manifest shape and version        — a lenient manifest passes every file
//   3 artifact digest                   — one check for the whole archive
//   4 archive readability               — a truncated artifact cannot reach 3
//   5 member paths                      — refused before any write, not during
//   6 per-file digests, both ways       — no recorded file absent, no extra file
//
// Nothing from the artifact is executed, required, imported, spawned or
// evaluated anywhere in this path. Members are bytes, and they become files.
import { createHash } from "node:crypto";

import type { ArchiveContents } from "./kit-archive-reader.js";
import { readKitArchive } from "./kit-archive-reader.js";
import type { KitManifest } from "./kit-manifest.js";
import { manifestFilesByPath, parseKitManifest } from "./kit-manifest.js";
import { KitVerificationError } from "./kit-refusal.js";
import { verifyManifestSignature } from "./kit-signature.js";
import { resolveSafeMemberPath, writeMember } from "./safe-extract.js";
import { TRUSTED_KIT_KEYS } from "./trusted-keys.js";

const sha256 = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");

export interface KitArtifactBytes {
	artifact: Buffer;
	manifestBytes: Buffer;
	signature: string | null;
}

export interface VerifiedKitArtifact {
	manifest: KitManifest;
	contents: ArchiveContents;
}

/**
 * Run every check. Throws `KitVerificationError` on the first failure, naming
 * the check and its subject; never returns a partial result, so a caller cannot
 * install "most of" a verified artifact.
 */
export function verifyKitArtifact(
	bytes: KitArtifactBytes,
	version: string,
	keys: readonly string[] = TRUSTED_KIT_KEYS,
): VerifiedKitArtifact {
	verifyManifestSignature(bytes.manifestBytes, bytes.signature, version, keys);
	const manifest = parseKitManifest(bytes.manifestBytes, version);

	if (sha256(bytes.artifact) !== manifest.artifact.sha256) {
		throw new KitVerificationError("artifact-digest", version, manifest.artifact.name);
	}

	let contents: ArchiveContents;
	try {
		contents = readKitArchive(bytes.artifact);
	} catch {
		throw new KitVerificationError("artifact-unreadable", version, manifest.artifact.name);
	}

	// A non-regular member is refused as an unsafe path rather than ignored: a
	// symlink member is how a later regular member is made to land outside the
	// destination, so the archive carrying one is the thing being refused.
	if (contents.nonRegular.length > 0) {
		throw new KitVerificationError("member-path-unsafe", version, contents.nonRegular[0]);
	}

	const expected = manifestFilesByPath(manifest);
	const seen = new Set<string>();
	for (const member of contents.members) {
		const entry = expected.get(member.path);
		if (entry === undefined) {
			throw new KitVerificationError("file-unexpected", version, member.path);
		}
		if (sha256(member.content) !== entry.sha256) {
			throw new KitVerificationError("file-digest", version, member.path);
		}
		seen.add(member.path);
	}
	for (const entry of manifest.files) {
		if (!seen.has(entry.path)) throw new KitVerificationError("file-missing", version, entry.path);
	}

	return { manifest, contents };
}

/**
 * Write a verified archive into `destination`. Every member path is resolved
 * through the shared path-safety helper FIRST, for every member, before any of
 * them is written — a per-member check interleaved with writes would already
 * have laid down files by the time it reached the hostile one.
 */
export async function extractVerifiedArchive(
	verified: VerifiedKitArtifact,
	destination: string,
	version: string,
): Promise<void> {
	const resolved: Array<{ target: string; member: (typeof verified.contents.members)[number] }> = [];
	for (const member of verified.contents.members) {
		const outcome = await resolveSafeMemberPath(destination, member.path);
		if ("reason" in outcome) {
			throw new KitVerificationError("member-path-unsafe", version, member.path);
		}
		resolved.push({ target: outcome.target, member });
	}
	for (const { target, member } of resolved) writeMember(target, member.content, member.mode);
}
