// Verifying the detached signature over a kit manifest.
//
// Three failures are distinguished rather than collapsed into one, because they
// have three different remedies: no signature at all means the release was built
// without one and a new release is needed; an unreadable signature means the
// file is damaged; a readable signature no listed key accepts means this CLI is
// older than the key that signed the release, so upgrading the CLI is the fix.
// A single "signature check failed" would send every one of those users to the
// wrong place.
//
// Verification runs against the keyring with no bypass of any kind — no flag, no
// environment variable, no prerelease exemption, and no "an empty keyring means
// accept anything" branch. The absence of a bypass is the property being bought;
// adding one and defaulting it off still adds it.
import { createPublicKey, verify } from "node:crypto";

import { KitVerificationError } from "./kit-refusal.js";
import { TRUSTED_KIT_KEYS } from "./trusted-keys.js";

/**
 * Check a base64 detached signature over `manifestBytes`.
 *
 * Throws a refusal rather than returning false, because every caller's only
 * correct response is to stop, and a boolean invites one of them to continue.
 */
export function verifyManifestSignature(
	manifestBytes: Buffer,
	signatureText: string | null,
	version: string,
	keys: readonly string[] = TRUSTED_KIT_KEYS,
): void {
	if (signatureText === null || signatureText.trim() === "") {
		throw new KitVerificationError("signature-absent", version, null);
	}
	let signature: Buffer;
	try {
		signature = Buffer.from(signatureText.trim(), "base64");
	} catch {
		throw new KitVerificationError("signature-malformed", version, null);
	}
	// An ed25519 signature is exactly 64 bytes. Anything else is not a short or
	// long signature, it is not a signature, and base64 decoding is lenient
	// enough that checking the length is the only thing that catches it.
	if (signature.length !== 64) {
		throw new KitVerificationError("signature-malformed", version, null);
	}
	// Checked after the signature is known to be well formed, so a release built
	// with no signature at all is still reported as "unsigned" rather than as
	// "this CLI has no key" — the user can act on the first and not the second.
	if (keys.length === 0) {
		throw new KitVerificationError("no-trusted-key", version, null);
	}

	for (const pem of keys) {
		let accepted = false;
		try {
			accepted = verify(null, manifestBytes, createPublicKey(pem), signature);
		} catch {
			// A malformed entry in the keyring is not a reason to accept the
			// artifact. Skip it and let the remaining keys decide.
			accepted = false;
		}
		if (accepted) return;
	}
	throw new KitVerificationError("signature-untrusted-key", version, null);
}
