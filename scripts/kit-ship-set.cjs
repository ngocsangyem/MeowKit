#!/usr/bin/env node
/**
 * The one answer to "which files does a published kit carry".
 *
 * Both release archives read the exclusion patterns from `base.exclude` in
 * `.meowkit/pack-manifest.json`. Keeping a second copy anywhere means a pattern
 * can be added to one archive and forgotten in the other, which publishes run
 * output or local state in whichever archive was missed — and each list still
 * looks complete when read on its own, so nothing reveals the gap.
 *
 * Pattern semantics match the archive matcher the zip build already used: `*`
 * matches any run of characters INCLUDING `/`, and `?` matches one character.
 * A pattern must match the whole repo-relative path.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PACK_MANIFEST_REL = path.join(".meowkit", "pack-manifest.json");

/**
 * The archive roots a published kit is built from, in a fixed order.
 *
 * Each `.meowkit/` entry is named as a single FILE, never as the directory: the
 * rest of `.meowkit/` is per-project state including `.env`, and must never
 * reach an archive.
 *
 * `harness-inventory.json` is the governance registry the pack checks read to
 * learn which pack owns each artifact. It is declared shipped content by the
 * pack manifest's own `base.files`, and it used to live under `.claude/` — so
 * when it moved here the archive stopped carrying it and nothing noticed,
 * because the only symptom is that an INSTALLED project fails its pack check
 * while the source tree passes. Naming it here is what makes the manifest's
 * declaration and the archive agree.
 *
 * `tasks/` is deliberately NOT a root. It is where a project writes its own
 * plans, contracts and verdicts, so archiving it made the kit carry empty
 * marker files and this repository's own working artifacts into every install.
 * Every writer under it creates the directory it needs on first write, and a
 * gate reads an absent directory as "no plan" — the same block, never an error.
 */
const ARCHIVE_TARGETS = [
	".claude",
	"release-manifest.json",
	path.join(".meowkit", "pack-manifest.json"),
	path.join(".meowkit", "harness-inventory.json"),
];

/** Roots that must exist, or the build is publishing an incomplete kit. */
const CRITICAL_TARGETS = [
	".claude",
	"release-manifest.json",
	path.join(".meowkit", "pack-manifest.json"),
	path.join(".meowkit", "harness-inventory.json"),
];

/** Read the exclusion patterns. Throws rather than defaulting to "exclude nothing". */
function shipSetExclusions(projectRoot) {
	const file = path.join(projectRoot, PACK_MANIFEST_REL);
	if (!fs.existsSync(file)) {
		throw new Error(`${PACK_MANIFEST_REL} not found — the ship set has no source`);
	}
	const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
	const patterns = manifest && manifest.base && manifest.base.exclude;
	if (!Array.isArray(patterns)) {
		throw new Error(`${PACK_MANIFEST_REL} has no base.exclude array — the ship set has no source`);
	}
	return patterns.map(String);
}

function patternToRegExp(pattern) {
	let out = "";
	for (const ch of pattern) {
		if (ch === "*") out += ".*";
		else if (ch === "?") out += ".";
		else out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	}
	return new RegExp(`^${out}$`);
}

/** A matcher over repo-relative, forward-slash paths. */
function excludeMatcher(patterns) {
	const compiled = patterns.map(patternToRegExp);
	return (relPath) => compiled.some((re) => re.test(relPath));
}

/**
 * Files the release pipeline writes into the tree just before archiving. They
 * are git-ignored on purpose, so the tracked-files check would otherwise drop
 * them from the kit they describe.
 */
const BUILD_OUTPUTS = new Set(["release-manifest.json"]);

/**
 * Every path git tracks under `projectRoot`, relative to it, forward slashes.
 *
 * Throws outside a git work tree rather than returning "everything": a release
 * built where tracking cannot be checked must not quietly fall back to shipping
 * whatever happens to be on disk.
 */
function trackedFiles(projectRoot) {
	let out;
	try {
		out = execFileSync("git", ["ls-files", "-z", "--", "."], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
			// The default 1 MB cap is within a few times of this repo's listing today.
			maxBuffer: 64 * 1024 * 1024,
		});
	} catch (error) {
		throw new Error(`cannot list git-tracked files in ${projectRoot}: ${error.message}`);
	}
	return new Set(out.toString("utf8").split("\0").filter(Boolean));
}

/**
 * Every file the kit ships, repo-relative with forward slashes, sorted.
 *
 * Only files git tracks are shipped (plus the named BUILD_OUTPUTS). A release is
 * built from a maintainer's working tree, and that tree carries files the repo
 * never meant to publish — `.claude/settings.local.json` ignored through a
 * personal global ignore, `.DS_Store`, scratch output. `base.exclude` can only
 * list what someone thought of; the tracked check closes the rest.
 *
 * Member order is pinned here rather than taken from the filesystem: readdir
 * order varies by filesystem and by machine, and an archive whose member order
 * varies has a different digest for identical content, which makes the digest
 * unusable as an identity for the content.
 */
function shipSetFiles(projectRoot, isExcluded) {
	const tracked = trackedFiles(projectRoot);
	const files = [];
	const walk = (rel) => {
		const abs = path.join(projectRoot, rel);
		const stat = fs.lstatSync(abs);
		if (stat.isSymbolicLink()) return;
		if (stat.isDirectory()) {
			for (const name of fs.readdirSync(abs)) walk(`${rel}/${name}`);
			return;
		}
		if (!stat.isFile()) return;
		if (isExcluded(rel)) return;
		if (!tracked.has(rel) && !BUILD_OUTPUTS.has(rel)) return;
		files.push(rel);
	};
	for (const target of ARCHIVE_TARGETS) {
		const rel = target.split(path.sep).join("/");
		if (!fs.existsSync(path.join(projectRoot, rel))) continue;
		walk(rel);
	}
	files.sort();
	return files;
}

/** Patterns rendered as the `-x <pattern>` argument pairs the zip build passes. */
function zipExcludeArgs(patterns) {
	return patterns.flatMap((pattern) => ["-x", pattern]);
}

module.exports = {
	ARCHIVE_TARGETS,
	CRITICAL_TARGETS,
	excludeMatcher,
	shipSetExclusions,
	shipSetFiles,
	zipExcludeArgs,
};
