#!/usr/bin/env node
/**
 * Build the kit artifact, the manifest that describes it, and the detached
 * signature over that manifest.
 *
 * Three files, one for each question a user has to be able to answer offline:
 *
 *   <artifact>        the kit content for one version, nothing else
 *   kit-manifest.json the artifact's own digest plus a digest per file inside it
 *   <manifest>.sig    a detached ed25519 signature over the manifest bytes
 *
 * The manifest is DERIVED from the artifact that was just written, never
 * assembled alongside it from the source tree. A manifest built from the tree
 * can disagree with the archive — a file excluded by one and not the other is
 * then signed but absent, or present but unsigned — and the disagreement is
 * invisible until an install fails on a digest nobody can reproduce.
 *
 * Nothing is written until the signature exists. A directory holding an artifact
 * and no signature is indistinguishable from one whose signature was stripped,
 * so the build either leaves all three files or none.
 *
 * Usage: node scripts/build-kit-artifact.cjs <version> [outDir]
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { buildTar, gzipDeterministic } = require("./kit-tar-writer.cjs");
const { excludeMatcher, shipSetExclusions, shipSetFiles } = require("./kit-ship-set.cjs");
const { signManifestBytes, signingKeyFromEnv } = require("./kit-signing.cjs");
const { KIT_VERSION_PATTERN } = require("./kit-version.cjs");

const MANIFEST_NAME = "kit-manifest.json";
const SIGNATURE_NAME = "kit-manifest.json.sig";
const MANIFEST_SCHEMA_VERSION = "1.0";

const artifactName = (version) => `meowkit-kit-${version}.tar.gz`;

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

/** Members of a tar, as `{ name, content }`, so digests come from the archive. */
function readTarMembers(tar) {
	const members = [];
	let offset = 0;
	while (offset + 512 <= tar.length) {
		const head = tar.subarray(offset, offset + 512);
		if (head.every((byte) => byte === 0)) break;
		const base = head.subarray(0, 100).toString("ascii").replace(/\0.*$/, "");
		const prefix = head.subarray(345, 500).toString("ascii").replace(/\0.*$/, "");
		const size = parseInt(head.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim(), 8);
		const start = offset + 512;
		members.push({ name: prefix === "" ? base : `${prefix}/${base}`, content: tar.subarray(start, start + size) });
		offset = start + Math.ceil(size / 512) * 512;
	}
	return members;
}

function main() {
	const version = process.argv[2];
	const outDir = path.resolve(process.argv[3] ?? path.join(process.cwd(), "dist"));
	if (!version) {
		console.error("Usage: node scripts/build-kit-artifact.cjs <version> [outDir]");
		process.exit(1);
	}
	// The same pattern the kit's version source applies, read from there rather
	// than restated: two copies is how a value that passes one and fails the other
	// reaches a release.
	if (!KIT_VERSION_PATTERN.test(version)) {
		console.error(`Invalid version format: ${version}`);
		process.exit(1);
	}

	const projectRoot = process.cwd();
	// The key is resolved FIRST. Everything after it writes files, and a build
	// that discovers a missing key only at the end has already produced an
	// unsigned artifact that a later step could upload.
	const privateKey = signingKeyFromEnv();

	const patterns = shipSetExclusions(projectRoot);
	const files = shipSetFiles(projectRoot, excludeMatcher(patterns));
	if (files.length === 0) throw new Error("the ship set is empty — nothing would be published");

	const tar = buildTar(projectRoot, files);
	const artifact = gzipDeterministic(tar);

	const members = readTarMembers(tar);
	const manifest = {
		schemaVersion: MANIFEST_SCHEMA_VERSION,
		version,
		artifact: { name: artifactName(version), sha256: sha256(artifact), size: artifact.length },
		files: members.map((member) => ({ path: member.name, sha256: sha256(member.content), size: member.content.length })),
	};
	// Serialized once, signed over exactly those bytes, and written byte-for-byte
	// as signed: a re-serialization with different spacing verifies against
	// nothing, and the failure looks like tampering.
	const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
	const signature = signManifestBytes(manifestBytes, privateKey);

	fs.mkdirSync(outDir, { recursive: true });
	fs.writeFileSync(path.join(outDir, manifest.artifact.name), artifact);
	fs.writeFileSync(path.join(outDir, MANIFEST_NAME), manifestBytes);
	fs.writeFileSync(path.join(outDir, SIGNATURE_NAME), `${signature}\n`, "utf8");

	console.log(`Built ${manifest.artifact.name} (${artifact.length} bytes, ${manifest.files.length} files)`);
	console.log(`  artifact sha256 ${manifest.artifact.sha256}`);
	console.log(`  manifest sha256 ${sha256(manifestBytes)}`);
}

if (require.main === module) {
	try {
		main();
	} catch (error) {
		console.error(`Failed to build the kit artifact: ${error.message}`);
		process.exit(1);
	}
}
