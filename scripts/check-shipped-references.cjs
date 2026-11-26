#!/usr/bin/env node
/**
 * A shipped file may name a path in this repository only when the kit ships it.
 *
 * Scans every text file the kit ships under `.claude/` for path-like tokens that
 * start with a repository folder, and fails on one that is tracked here but left
 * out of the ship set (a maintainer script, a test, a crate, an unshipped skill),
 * or that starts with `.claude/` and exists nowhere. An installed kit cannot
 * resolve either: the user's project has neither the file nor this repository.
 *
 * Paths a user's project owns (`docs/…`, `tasks/…`, `.meowkit/…`) are other
 * checks' business: `mewkit validate` holds `docs/` paths to an allowlist.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ship = require("./kit-ship-set.cjs");

const ROOT = path.resolve(__dirname, "..");

/** Paths a shipped file may name without the kit shipping them, each with its reason. */
const ALLOWED = [
	{ path: ".github/workflows", why: "a user project's CI folder, named as an example of one" },
	{ path: ".github/workflows/ci.yml", why: "a user project's CI file, named as an example of one" },
	{ path: ".claude/session-state", why: "state folder of an older install, still skipped by the completion check" },
	{ path: ".claude/logs", why: "log folder of an older install, still skipped by the completion check" },
	{ path: ".claude/cache", why: "cache folder of an older install, still skipped by the completion check" },
	{ path: ".claude/hooks/pre", why: "a folder OMP scans; named to explain why no kit hook sits there" },
];

const TEXT = /\.(md|mdc|cjs|js|sh|py|json|yaml|yml|toml|txt)$/;
const SKIPPED = /\/(__tests__|tests?|eval|evals|fixtures)\//;
const TOKEN = /(?<![\w/.@~-])((?:\.claude|docs|scripts|crates|packages|kit|\.github)\/[A-Za-z0-9_./-]*[A-Za-z0-9_/-])/g;

function withDirs(files) {
	const all = new Set(files);
	for (const file of files) {
		let dir = file;
		while ((dir = path.posix.dirname(dir)) !== ".") all.add(dir);
	}
	return all;
}

function findings(root = ROOT) {
	const shipped = ship.shipSetFiles(root, ship.excludeMatcher(ship.shipSetExclusions(root)));
	const shippedPaths = withDirs(shipped);
	const tracked = withDirs(
		execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 })
			.split("\n")
			.filter(Boolean),
	);
	const allowed = new Set(ALLOWED.map((entry) => entry.path));
	const out = [];
	for (const file of shipped) {
		if (!file.startsWith(".claude/") || !TEXT.test(file) || SKIPPED.test(file)) continue;
		const lines = fs.readFileSync(path.join(root, file), "utf8").split("\n");
		lines.forEach((line, index) => {
			for (const match of line.matchAll(TOKEN)) {
				const ref = match[1].replace(/[./]+$/, "");
				const next = line.slice(match.index + match[1].length, match.index + match[1].length + 1);
				// A placeholder (`<name>`, `{x}`, `*`, `$VAR`) names no one file.
				if (/[<{*$]/.test(next) || /[<>{}*$]/.test(ref)) continue;
				if (shippedPaths.has(ref) || allowed.has(ref)) continue;
				const inRepository = tracked.has(ref);
				if (ref.startsWith(".claude/") || inRepository) {
					const kind = inRepository ? "in this repository but not shipped" : "not a file the kit has";
					out.push(`${file}:${index + 1}: \`${ref}\` (${kind})`);
				}
			}
		});
	}
	return out;
}

if (require.main === module) {
	const found = findings();
	for (const line of found) process.stderr.write(`${line}\n`);
	if (found.length) {
		process.stderr.write(
			`\n${found.length} shipped reference(s) to a path an installed kit does not have. ` +
				"Reword the line, name the shipped file, or add the path to ALLOWED with its reason.\n",
		);
		process.exit(1);
	}
	process.stdout.write("OK: every repository path a shipped file names is one the kit ships\n");
}

module.exports = { ALLOWED, findings };
