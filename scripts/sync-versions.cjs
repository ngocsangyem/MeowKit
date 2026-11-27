#!/usr/bin/env node
/**
 * Single-source version sync. The kit and the `mewkit` binary share ONE version.
 *
 * Source of truth: root `package.json` `version`. This script stamps it into:
 *   - `[workspace.package] version` in the root `Cargo.toml` (every crate inherits it),
 *   - the workspace crates' entries in `Cargo.lock` (CI builds with `--locked`),
 *   - `.claude/kit-contract.json` `kitVersion` (what an installer reads from the zip),
 *   - `release-manifest.json` `version` and `cliVersion` (gitignored, may be absent).
 *
 * Field-level only: never touches the manifest's `files[]` (regenerated at release time by
 * `generate-release-manifest.cjs`), so it is safe to run anytime.
 *
 *   node scripts/sync-versions.cjs                 # --check (default): verify, exit 1 on mismatch
 *   node scripts/sync-versions.cjs --write         # stamp every surface from root package.json
 *   node scripts/sync-versions.cjs --set <ver>     # set root package.json to <ver>, then --write
 */

const fs = require("fs");
const path = require("path");
const { cliVersion: readCliVersion } = require("./lib/cli-version.cjs");

const root = path.join(__dirname, "..");
const ROOT_PKG = path.join(root, "package.json");
const CARGO_TOML = path.join(root, "Cargo.toml");
const CARGO_LOCK = path.join(root, "Cargo.lock");
const RELEASE_MANIFEST = path.join(root, "release-manifest.json");
const KIT_CONTRACT = path.join(root, ".claude", "kit-contract.json");
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/;

const args = process.argv.slice(2);
const setIdx = args.indexOf("--set");
const setVersion = setIdx >= 0 ? args[setIdx + 1] : null;
const write = args.includes("--write") || setVersion !== null;

function readJson(p) {
	return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, obj) {
	fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}
const rel = (p) => path.relative(root, p);

if (setVersion !== null) {
	if (!SEMVER.test(setVersion || "")) {
		console.error(`--set needs a semver version, got: ${setVersion ?? "(none)"}`);
		process.exit(1);
	}
	const pkg = readJson(ROOT_PKG);
	pkg.version = setVersion;
	writeJson(ROOT_PKG, pkg);
}

const version = readJson(ROOT_PKG).version;

/** Names of the crates that live in this workspace (their lock entries carry our version). */
function workspaceCrates() {
	const dir = path.join(root, "crates");
	return fs
		.readdirSync(dir)
		.map((d) => path.join(dir, d, "Cargo.toml"))
		.filter((f) => fs.existsSync(f))
		.map((f) => (fs.readFileSync(f, "utf8").match(/^name\s*=\s*"([^"]+)"/m) || [])[1])
		.filter(Boolean);
}

/** Lock entries of workspace crates whose version differs from `version`. */
function lockDrift(text, crates) {
	const drift = [];
	for (const name of crates) {
		const m = text.match(new RegExp(`\\[\\[package\\]\\]\\r?\\nname = "${name}"\\r?\\nversion = "([^"]+)"`));
		if (m && m[1] !== version) drift.push({ name, actual: m[1] });
	}
	return drift;
}

const mismatches = [];
const stamped = [];

// Cargo.toml [workspace.package] version.
const cargoActual = readCliVersion(root);
if (cargoActual !== version) {
	if (write) {
		const text = fs.readFileSync(CARGO_TOML, "utf8");
		const next = text.replace(/(\[workspace\.package\][^[]*?^version\s*=\s*")[^"]+(")/m, `$1${version}$2`);
		if (next === text) {
			console.error("Cargo.toml has no [workspace.package] version to stamp");
			process.exit(1);
		}
		fs.writeFileSync(CARGO_TOML, next, "utf8");
		stamped.push(`${rel(CARGO_TOML)} [workspace.package] version: ${cargoActual} -> ${version}`);
	} else {
		mismatches.push(
			`${rel(CARGO_TOML)} [workspace.package] version is ${cargoActual ?? "(none)"}, expected ${version}`,
		);
	}
}

// Cargo.lock workspace crate entries.
if (fs.existsSync(CARGO_LOCK)) {
	const crates = workspaceCrates();
	let text = fs.readFileSync(CARGO_LOCK, "utf8");
	const drift = lockDrift(text, crates);
	if (drift.length > 0 && write) {
		for (const { name } of drift) {
			text = text.replace(
				new RegExp(`(\\[\\[package\\]\\]\\r?\\nname = "${name}"\\r?\\nversion = ")[^"]+(")`),
				`$1${version}$2`,
			);
		}
		fs.writeFileSync(CARGO_LOCK, text, "utf8");
		stamped.push(`${rel(CARGO_LOCK)} ${drift.map((d) => d.name).join(", ")} -> ${version}`);
	} else {
		for (const d of drift) mismatches.push(`${rel(CARGO_LOCK)} ${d.name} is ${d.actual}, expected ${version}`);
	}
}

// JSON surfaces. `optional` = gitignored release-time artifact that may be absent.
const targets = [
	{ file: KIT_CONTRACT, field: "kitVersion", optional: false },
	{ file: RELEASE_MANIFEST, field: "version", optional: true },
	{ file: RELEASE_MANIFEST, field: "cliVersion", optional: true },
];
for (const t of targets) {
	if (!fs.existsSync(t.file)) {
		if (!t.optional) mismatches.push(`${rel(t.file)} is missing`);
		continue;
	}
	const obj = readJson(t.file);
	const actual = obj[t.field];
	if (actual === version) continue;
	if (write) {
		obj[t.field] = version;
		writeJson(t.file, obj);
		stamped.push(`${rel(t.file)} ${t.field}: ${actual ?? "(none)"} -> ${version}`);
	} else {
		mismatches.push(`${rel(t.file)} ${t.field} is ${actual ?? "(none)"}, expected ${version}`);
	}
}

if (write) {
	if (mismatches.length > 0) {
		for (const m of mismatches) console.error(`  - ${m}`);
		process.exit(1);
	}
	for (const s of stamped) console.log(`  stamped ${s}`);
	console.log(`Synced kit and binary to v${version}.`);
	process.exit(0);
}

if (mismatches.length > 0) {
	console.error(`Version mismatch (root package.json is the source of truth, v${version}):`);
	for (const m of mismatches) console.error(`  - ${m}`);
	console.error("Run `node scripts/sync-versions.cjs --write` (or `--set <version>`).");
	process.exit(1);
}
console.log(`Versions consistent: kit and binary v${version}.`);
process.exit(0);
