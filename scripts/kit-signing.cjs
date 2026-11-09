#!/usr/bin/env node
/**
 * Signing side of the kit artifact: a detached ed25519 signature over the
 * manifest bytes, made with the platform's own crypto and no dependency.
 *
 * The signing key never appears on disk in the pipeline. It arrives as an
 * environment value, is used once, and is not written anywhere — so a build log,
 * a cached workspace or a failed job leaves no copy behind.
 *
 * There is no "sign if a key happens to be present" path. A build with no key
 * raises, the caller publishes nothing, and the release carries no artifact at
 * all — which the install side already handles, because older releases have no
 * artifact either. The alternative, publishing unsigned bytes, would make the
 * signature advisory: a tampered artifact would simply arrive unsigned and be
 * accepted on the same terms.
 */

const crypto = require("crypto");

const SIGNING_KEY_ENV = "MEOWKIT_KIT_SIGNING_KEY";

/**
 * The private key from the environment, as a key object.
 *
 * Accepts a PKCS#8 PEM, optionally base64-wrapped so it survives a single-line
 * secret store. The value is never logged and never returned as text.
 */
function signingKeyFromEnv() {
	const raw = process.env[SIGNING_KEY_ENV];
	if (raw === undefined || raw.trim() === "") {
		throw new Error(
			`${SIGNING_KEY_ENV} is not set, so the kit manifest cannot be signed. ` +
				"Publishing an unsigned artifact would make every later signature check advisory, " +
				"so no artifact is written. Set the secret on the release workflow and re-run it.",
		);
	}
	const text = raw.includes("PRIVATE KEY") ? raw : Buffer.from(raw.trim(), "base64").toString("utf8");
	if (!text.includes("PRIVATE KEY")) {
		throw new Error(
			`${SIGNING_KEY_ENV} is set but is not a PKCS#8 private key, in PEM or base64-wrapped PEM form. ` +
				"No artifact is written. Re-create the secret from the key the generation script produced.",
		);
	}
	let key;
	try {
		key = crypto.createPrivateKey(text);
	} catch {
		// The underlying error text can carry key bytes, so it is not surfaced.
		throw new Error(
			`${SIGNING_KEY_ENV} could not be parsed as a private key. No artifact is written. ` +
				"Re-create the secret from the key the generation script produced.",
		);
	}
	if (key.asymmetricKeyType !== "ed25519") {
		throw new Error(
			`${SIGNING_KEY_ENV} holds a ${key.asymmetricKeyType} key, but the kit manifest is signed with ed25519. ` +
				"No artifact is written.",
		);
	}
	return key;
}

/** Detached signature over exactly the bytes handed in, base64-encoded. */
function signManifestBytes(bytes, privateKey) {
	return crypto.sign(null, bytes, privateKey).toString("base64");
}

module.exports = { signManifestBytes, signingKeyFromEnv };
