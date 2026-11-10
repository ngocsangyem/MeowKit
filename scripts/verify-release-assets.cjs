#!/usr/bin/env node
/**
 * Verify the built kit release assets before they are uploaded.
 *
 *   node scripts/verify-release-assets.cjs <version> [distDir]
 *
 * Checks, all reported before exiting non-zero:
 *   - dist/meowkit-release.zip exists
 *   - it carries .claude/kit-contract.json with an integer `kitContract`, a `requires.mewkitMin`
 *     semver and `kitVersion` equal to <version>
 *   - dist/checksums.txt names the zip and its SHA-256 matches the zip bytes
 *   - dist/ holds none of the signed-artifact assets: CLIs that understand them have an empty
 *     trusted keyring, so a release carrying them is refused instead of installed
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const ZIP_NAME = "meowkit-release.zip";
const CHECKSUMS_NAME = "checksums.txt";
const CONTRACT_MEMBER = ".claude/kit-contract.json";
const SEMVER = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

/** Asset names that artifact-aware CLIs treat as a signed kit. */
function isSignedArtifactAsset(name) {
	return (name.startsWith("meowkit-kit-") && name.endsWith(".tar.gz")) || name === "kit-manifest.json" || name.endsWith(".sig");
}

function sha256(file) {
	return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** Parse `<sha256>  <name>` lines into a name → hash map. */
function parseChecksums(text) {
	const entries = new Map();
	for (const line of text.split("\n")) {
		const match = line.trim().match(/^([0-9a-f]{64}) [ *]?(.+)$/);
		if (match) entries.set(match[2], match[1]);
	}
	return entries;
}

function checkContract(zipPath, version, problems) {
	const read = spawnSync("unzip", ["-p", zipPath, CONTRACT_MEMBER], { encoding: "utf8" });
	if (read.status !== 0 || read.stdout.trim() === "") {
		problems.push(`${ZIP_NAME} does not contain ${CONTRACT_MEMBER}`);
		return;
	}
	let contract;
	try {
		contract = JSON.parse(read.stdout);
	} catch (error) {
		problems.push(`${CONTRACT_MEMBER} in the zip is not valid JSON: ${error.message}`);
		return;
	}
	if (!Number.isInteger(contract.kitContract) || contract.kitContract < 1) {
		problems.push(`${CONTRACT_MEMBER}: kitContract must be a positive integer`);
	}
	if (!SEMVER.test(String(contract.requires && contract.requires.mewkitMin))) {
		problems.push(`${CONTRACT_MEMBER}: requires.mewkitMin must be a semver`);
	}
	if (contract.kitVersion !== version) {
		problems.push(`${CONTRACT_MEMBER}: kitVersion is ${contract.kitVersion}, expected ${version}`);
	}
}

function verifyReleaseAssets(version, distDir) {
	const problems = [];
	const zipPath = path.join(distDir, ZIP_NAME);
	const checksumsPath = path.join(distDir, CHECKSUMS_NAME);

	if (!fs.existsSync(zipPath)) {
		problems.push(`${zipPath} is missing`);
	} else {
		checkContract(zipPath, version, problems);
		if (!fs.existsSync(checksumsPath)) {
			problems.push(`${checksumsPath} is missing`);
		} else {
			const recorded = parseChecksums(fs.readFileSync(checksumsPath, "utf8")).get(ZIP_NAME);
			if (recorded === undefined) problems.push(`${CHECKSUMS_NAME} has no entry for ${ZIP_NAME}`);
			else if (recorded !== sha256(zipPath)) problems.push(`${CHECKSUMS_NAME} does not match ${ZIP_NAME}`);
		}
	}

	if (fs.existsSync(distDir)) {
		for (const name of fs.readdirSync(distDir)) {
			if (isSignedArtifactAsset(name)) problems.push(`${path.join(distDir, name)} is a signed-artifact asset; remove it before releasing`);
		}
	}
	return problems;
}

module.exports = { verifyReleaseAssets, parseChecksums, sha256, isSignedArtifactAsset, ZIP_NAME, CHECKSUMS_NAME };

if (require.main === module) {
	const version = process.argv[2];
	const distDir = path.resolve(process.argv[3] || "dist");
	if (!version || !SEMVER.test(version)) {
		console.error("Usage: node scripts/verify-release-assets.cjs <version> [distDir]");
		process.exit(1);
	}
	const problems = verifyReleaseAssets(version, distDir);
	if (problems.length > 0) {
		console.error("Release assets failed verification:");
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}
	console.log(`Release assets verified: ${ZIP_NAME} + ${CHECKSUMS_NAME} for v${version}.`);
}
