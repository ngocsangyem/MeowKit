#!/usr/bin/env node
/**
 * Generate the keypair that signs kit manifests. Run by a person, never by the
 * pipeline and never by an agent.
 *
 * The private key goes to the path the caller names and nowhere else — not to a
 * default location, not to the repository, not to standard output. The public
 * key is printed, because it is the half that gets committed to the keyring, and
 * printing it is how it reaches a human who can paste it there.
 *
 * Writing the private key to a chosen path rather than printing it is the whole
 * point: anything printed lands in a terminal scrollback, a shell history or a
 * CI log, and a signing key that has been in a log is no longer a signing key.
 *
 * Usage: node scripts/generate-kit-signing-key.cjs <private-key-output-path>
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function main() {
	const target = process.argv[2];
	if (!target) {
		console.error("Usage: node scripts/generate-kit-signing-key.cjs <private-key-output-path>");
		console.error("The private key is written to that path. Keep it out of any repository.");
		process.exit(1);
	}
	const resolved = path.resolve(target);
	if (fs.existsSync(resolved)) {
		console.error(`${resolved} already exists. Refusing to overwrite a key file.`);
		process.exit(1);
	}

	const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
	const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
	const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();

	fs.mkdirSync(path.dirname(resolved), { recursive: true });
	// 0600 before any content: a key that is briefly group-readable has been
	// readable, and the window is not something the caller can audit afterwards.
	fs.writeFileSync(resolved, privatePem, { encoding: "utf8", mode: 0o600 });

	console.log(`Private key written to ${resolved} (mode 0600). It is not printed here by design.`);
	console.log("Store it as the release workflow secret MEOWKIT_KIT_SIGNING_KEY, then delete the file.");
	console.log("");
	console.log("Public key — add this to the trusted keyring in the CLI source:");
	console.log("");
	console.log(publicPem.trim());
}

if (require.main === module) main();
