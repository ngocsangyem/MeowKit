#!/usr/bin/env node
/**
 * Single-source version sync for the KIT (harness) version.
 *
 * Source of truth: root `package.json` `version`. This script stamps that version into the kit's
 * tracked identity file `.claude/meowkit.config.json` and into `release-manifest.json`, and
 * records the CLI package version (`packages/mewkit/package.json`, a SEPARATE semver track) into
 * the manifest as `cliVersion` (recorded, never overwritten to match the kit).
 *
 * Field-level only: it touches `version` / `cliVersion`, never the manifest's `files[]` (that is
 * regenerated at release time by `generate-release-manifest.cjs`), so it is safe to run anytime.
 *
 *   node scripts/sync-versions.cjs           # --check (default): verify, exit 1 on mismatch
 *   node scripts/sync-versions.cjs --write    # stamp the derived surfaces from root
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const ROOT_PKG = path.join(root, "package.json");
const CLI_PKG = path.join(root, "packages", "mewkit", "package.json");
const CLAUDE_CONFIG = path.join(root, ".claude", "meowkit.config.json");
const RELEASE_MANIFEST = path.join(root, "release-manifest.json");

const write = process.argv.includes("--write");

function readJson(p) {
	return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, obj) {
	fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

const kitVersion = readJson(ROOT_PKG).version;
const cliVersion = readJson(CLI_PKG).version;

// Each target: the file, the field, the expected value, whether --write stamps it, and whether it
// is optional. `optional: true` = a gitignored, release-time artifact (release-manifest.json)
// that may be absent on a fresh clone — absent is N/A, not a mismatch (it is regenerated at
// release by generate-release-manifest.cjs).
const targets = [
	{ file: CLAUDE_CONFIG, field: "version", expected: kitVersion, stamp: true, optional: false },
	{ file: RELEASE_MANIFEST, field: "version", expected: kitVersion, stamp: true, optional: true },
	{ file: RELEASE_MANIFEST, field: "cliVersion", expected: cliVersion, stamp: true, optional: true },
];

const mismatches = [];
for (const t of targets) {
	if (!fs.existsSync(t.file)) {
		if (!t.optional) mismatches.push(`${path.relative(root, t.file)} is missing`);
		continue;
	}
	const obj = readJson(t.file);
	const actual = obj[t.field];
	if (actual === t.expected) continue;
	if (write && t.stamp) {
		obj[t.field] = t.expected;
		writeJson(t.file, obj);
		console.log(`  stamped ${path.relative(root, t.file)} ${t.field}: ${actual ?? "(none)"} -> ${t.expected}`);
	} else {
		mismatches.push(`${path.relative(root, t.file)} ${t.field} is ${actual ?? "(none)"}, expected ${t.expected}`);
	}
}

if (write) {
	console.log(`Synced kit surfaces to v${kitVersion} (CLI recorded as v${cliVersion}).`);
	process.exit(0);
}

if (mismatches.length > 0) {
	console.error(`Version mismatch (root package.json is the source of truth, kit v${kitVersion}):`);
	for (const m of mismatches) console.error(`  - ${m}`);
	console.error("Run `node scripts/sync-versions.cjs --write`, then rebuild the release manifest.");
	process.exit(1);
}
console.log(`Versions consistent: kit v${kitVersion}, CLI v${cliVersion}.`);
process.exit(0);
