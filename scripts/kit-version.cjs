#!/usr/bin/env node
/**
 * The kit's version, and the one definition of what a kit version looks like.
 *
 * Root `package.json` `version` is the single source of truth for the KIT
 * version — `scripts/release.sh` refuses a release whose argument disagrees with
 * it, and `scripts/sync-versions.cjs` stamps it into `release-manifest.json` and
 * the kit's config. (`packages/mewkit/package.json` is the CLI's own, separate
 * semver track.) Anything that needs the kit version at build time reads it from
 * here rather than guessing.
 *
 * The guess that made this necessary: a release workflow derived the version
 * from `github.ref_name`, which is a branch name — `main` or `dev` — and the
 * artifact build rejects it. The step is deliberately fail-closed, so every
 * release run failed before it could publish anything.
 *
 * Usage: node scripts/kit-version.cjs      # prints the kit version, exit 0
 */

const fs = require("fs");
const path = require("path");

/**
 * What a kit version may look like. Exported so the build script's rejection and
 * the workflow's fallback are checked against the same rule: two copies of this
 * pattern is how a value that passes one and fails the other gets shipped.
 */
const KIT_VERSION_PATTERN = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

const ROOT = path.join(__dirname, "..");

/** The kit version from its single source. Throws rather than returning a guess. */
function kitVersion(root = ROOT) {
	const file = path.join(root, "package.json");
	const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
	const version = parsed.version;
	if (typeof version !== "string" || !KIT_VERSION_PATTERN.test(version)) {
		throw new Error(`package.json version is not a usable kit version: ${String(version)}`);
	}
	return version;
}

if (require.main === module) {
	try {
		process.stdout.write(`${kitVersion()}\n`);
	} catch (error) {
		console.error(`Could not determine the kit version: ${error.message}`);
		process.exit(1);
	}
}

module.exports = { KIT_VERSION_PATTERN, kitVersion };
