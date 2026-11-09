// The document that makes one signature authenticate every file.
//
// The signature covers the manifest bytes; the manifest records the artifact's
// own digest and a digest for every file inside it. So one signature check plus
// one artifact-digest check authenticates the whole archive, and the per-file
// digests then catch a file swapped inside an archive that still hashes to the
// recorded value — which cannot happen, but is the kind of thing a per-file
// record makes impossible to argue about.
//
// Validation is deliberately strict about shape. A manifest missing its file
// list is not "a manifest with nothing to check": it is a manifest that would
// make every file pass, so it is refused as malformed rather than read leniently.
import { z } from "zod";

import { KitVerificationError } from "./kit-refusal.js";

export const KIT_MANIFEST_FILENAME = "kit-manifest.json";
export const KIT_SIGNATURE_FILENAME = "kit-manifest.json.sig";

const SHA256 = /^[0-9a-f]{64}$/;

const KitManifestFileSchema = z.object({
	path: z.string().min(1),
	sha256: z.string().regex(SHA256),
	size: z.number().int().nonnegative(),
});

export const KitManifestSchema = z.object({
	schemaVersion: z.string().min(1),
	version: z.string().min(1),
	artifact: z.object({
		name: z.string().min(1),
		sha256: z.string().regex(SHA256),
		size: z.number().int().nonnegative(),
	}),
	files: z.array(KitManifestFileSchema).min(1),
});

export type KitManifest = z.infer<typeof KitManifestSchema>;

/**
 * Parse manifest bytes. `requestedVersion` is what the caller asked for; a
 * manifest for another version is malformed FOR THIS ATTEMPT, because installing
 * it would lay down content the user did not ask for under a label that says
 * they did.
 */
export function parseKitManifest(bytes: Buffer, requestedVersion: string): KitManifest {
	let parsed: unknown;
	try {
		parsed = JSON.parse(bytes.toString("utf8"));
	} catch {
		throw new KitVerificationError("manifest-malformed", requestedVersion, KIT_MANIFEST_FILENAME);
	}
	const result = KitManifestSchema.safeParse(parsed);
	if (!result.success) {
		throw new KitVerificationError("manifest-malformed", requestedVersion, KIT_MANIFEST_FILENAME);
	}
	if (result.data.version !== requestedVersion) {
		throw new KitVerificationError("manifest-malformed", requestedVersion, KIT_MANIFEST_FILENAME);
	}
	return result.data;
}

/** The manifest's file entries indexed by archive member path. */
export function manifestFilesByPath(manifest: KitManifest): Map<string, KitManifest["files"][number]> {
	const index = new Map<string, KitManifest["files"][number]>();
	for (const entry of manifest.files) index.set(entry.path, entry);
	return index;
}
