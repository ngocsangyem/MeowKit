#!/usr/bin/env node
"use strict";
/**
 * Computes and validates release versions from git tags, so no pull request ever edits a
 * version by hand. Kit and binary share one version; kit tags are `v<version>`, binary tags
 * `mewkit-v<version>`. Both count: the binary is published first, so a release that failed
 * after its binary holds `mewkit-v<version>` only, and that number is used up.
 *
 *   node scripts/release/next-version.cjs beta [--json]
 *       Next beta for the current HEAD: base = latest stable bumped by the highest
 *       conventional-commit level since it (`!`/BREAKING CHANGE → major, feat → minor,
 *       else patch), never below a base an existing beta already used; N = highest N + 1.
 *   node scripts/release/next-version.cjs stable --branch release/v3.2.0 [--json]
 *       Target from a `release/vX.Y.Z` or `hotfix/vX.Y.Z` branch. Fails unless it is
 *       strictly greater than the latest stable and neither `vX.Y.Z` nor `mewkit-vX.Y.Z` exists.
 *
 *   node scripts/release/next-version.cjs channels
 *       {"stable": newest kit stable, "beta": newest kit beta when ahead of it, else null},
 *       for the docs channel switcher.
 *
 * The decision logic is pure (exported, tested with fixtures); only `main()` reads git.
 */

const { execFileSync } = require("node:child_process");

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.]+))?$/;
const STABLE_BRANCH = /^(?:release|hotfix)\/v(\d+\.\d+\.\d+)$/;

/** Parses `X.Y.Z[-pre]` into parts, or null. */
function parse(version) {
	const m = SEMVER.exec(version);
	if (!m) return null;
	return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ? m[4].split(".") : [] };
}

/** SemVer 2.0 precedence: negative when a < b. Numeric identifiers compare numerically. */
function compare(a, b) {
	const pa = typeof a === "string" ? parse(a) : a;
	const pb = typeof b === "string" ? parse(b) : b;
	for (const k of ["major", "minor", "patch"]) if (pa[k] !== pb[k]) return pa[k] - pb[k];
	if (pa.pre.length === 0 || pb.pre.length === 0) return pb.pre.length - pa.pre.length;
	for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
		const x = pa.pre[i];
		const y = pb.pre[i];
		if (x === undefined) return -1;
		if (y === undefined) return 1;
		const nx = /^\d+$/.test(x);
		const ny = /^\d+$/.test(y);
		if (nx && ny && +x !== +y) return +x - +y;
		if (nx !== ny) return nx ? -1 : 1;
		if (x !== y) return x < y ? -1 : 1;
	}
	return 0;
}

const core = (p) => `${p.major}.${p.minor}.${p.patch}`;

/** Release versions from tag names: `v3.1.1` and `mewkit-v3.1.1` → `3.1.1`; others dropped. */
function kitVersions(tags) {
	return tags
		.map((t) => t.trim())
		.filter((t) => /^(mewkit-)?v\d/.test(t))
		.map((t) => t.replace(/^(mewkit-)?v/, ""))
		.filter((v) => parse(v));
}

function latestStable(versions) {
	return (
		versions
			.filter((v) => parse(v).pre.length === 0)
			.sort(compare)
			.pop() || "0.0.0"
	);
}

/** Highest bump level among commit messages: 3 major, 2 minor, 1 patch. */
function bumpLevel(messages) {
	let level = 1;
	for (const msg of messages) {
		const subject = msg.split("\n")[0];
		if (/^[a-z]+(\([^)]*\))?!:/.test(subject) || /^BREAKING[ -]CHANGE:/m.test(msg)) return 3;
		if (/^feat(\([^)]*\))?:/.test(subject)) level = 2;
	}
	return level;
}

function bump(version, level) {
	const p = parse(version);
	if (level === 3) return `${p.major + 1}.0.0`;
	if (level === 2) return `${p.major}.${p.minor + 1}.0`;
	return `${p.major}.${p.minor}.${p.patch + 1}`;
}

/** Next beta version from released tags and the commit messages since the latest stable. */
function nextBeta(tags, messages) {
	const versions = kitVersions(tags);
	const stable = latestStable(versions);
	let base = bump(stable, bumpLevel(messages));
	// Betas already published above the stable keep their base: a later release never goes
	// back below a number users on the beta channel already have.
	for (const v of versions) {
		const p = parse(v);
		if (p.pre.length > 0 && compare(core(p), stable) > 0 && compare(core(p), base) > 0) base = core(p);
	}
	let n = 0;
	for (const v of versions) {
		const p = parse(v);
		if (core(p) === base && p.pre[0] === "beta" && /^\d+$/.test(p.pre[1] || "")) n = Math.max(n, +p.pre[1]);
	}
	return { version: `${base}-beta.${n + 1}`, latestStable: stable };
}

/** Validates the stable target named by a release/hotfix branch. Throws with the reason. */
function stableTarget(branch, tags) {
	const m = STABLE_BRANCH.exec(branch || "");
	if (!m) throw new Error(`branch "${branch}" is not release/vX.Y.Z or hotfix/vX.Y.Z`);
	const target = m[1];
	const versions = kitVersions(tags);
	const stable = latestStable(versions);
	if (versions.includes(target)) throw new Error(`v${target} or mewkit-v${target} is already tagged`);
	if (compare(target, stable) <= 0) throw new Error(`v${target} is not greater than the latest stable v${stable}`);
	return { version: target, latestStable: stable };
}

/**
 * What each docs channel shows: the newest published kit stable, and the newest kit beta only
 * when it is ahead of that stable (null otherwise). Kit tags only: a release whose kit never
 * published is not something a reader can install.
 */
function channels(tags) {
	const kit = tags.map((t) => t.trim()).filter((t) => /^v\d/.test(t));
	const versions = kitVersions(kit);
	const stable = latestStable(versions);
	const beta =
		versions
			.filter((v) => parse(v).pre.length > 0)
			.sort(compare)
			.pop() || null;
	return { stable, beta: beta && compare(beta, stable) > 0 ? beta : null };
}

function git(args) {
	return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function main(argv) {
	const [mode, ...rest] = argv;
	const json = rest.includes("--json");
	const branchIdx = rest.indexOf("--branch");
	const tags = git(["tag", "--list", "v*", "mewkit-v*"]).split("\n").filter(Boolean);
	let result;
	if (mode === "beta") {
		const stable = latestStable(kitVersions(tags));
		const range = tags.includes(`v${stable}`) ? [`v${stable}..HEAD`] : ["HEAD"];
		const messages = git(["log", "--format=%B%x00", ...range])
			.split("\0")
			.map((s) => s.trim())
			.filter(Boolean);
		result = nextBeta(tags, messages);
	} else if (mode === "stable") {
		result = stableTarget(branchIdx >= 0 ? rest[branchIdx + 1] : process.env.GITHUB_REF_NAME, tags);
	} else if (mode === "channels") {
		process.stdout.write(`${JSON.stringify(channels(tags))}\n`);
		return;
	} else {
		throw new Error("usage: next-version.cjs <beta|stable --branch release/vX.Y.Z|channels> [--json]");
	}
	process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${result.version}\n`);
}

if (require.main === module) {
	try {
		main(process.argv.slice(2));
	} catch (err) {
		console.error(`next-version: ${err.message}`);
		process.exit(1);
	}
}

module.exports = { parse, compare, kitVersions, latestStable, bumpLevel, bump, nextBeta, stableTarget, channels };
