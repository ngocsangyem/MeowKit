#!/usr/bin/env node
"use strict";
/**
 * Changelog fragments. Each pull request adds its own file under `changes/` instead of editing
 * one shared `## Unreleased` section, so concurrent pull requests never conflict on it.
 *
 * A fragment is Markdown with one frontmatter key:
 *
 *   ---
 *   section: Bug Fixes
 *   ---
 *   - `mewkit init` no longer ...
 *
 *   node scripts/release/assemble-changelog.cjs check
 *       Validate every fragment (CI).
 *   node scripts/release/assemble-changelog.cjs notes [--since <git-ref>]
 *       Print release notes from the fragments (only those added after <git-ref>).
 *   node scripts/release/assemble-changelog.cjs stable <version> [--date YYYY-MM-DD]
 *       Insert `## <version> (<date>)` into the docs changelog from every fragment, then
 *       delete the fragments (a stable release consumes them).
 *   node scripts/release/assemble-changelog.cjs section <version>
 *       Print the published `## <version>` section body (stable release notes).
 *   node scripts/release/assemble-changelog.cjs require --base <git-ref>
 *       Fail when the diff from <git-ref> touches shipped paths but adds no fragment.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..", "..");
const CHANGES_DIR = path.join(ROOT, "changes");
const CHANGELOG = path.join(ROOT, "packages", "docs", "content", "docs", "changelog", "index.mdx");
// Same order the published changelog uses (its "Section schema" line).
const SECTIONS = [
	"Highlights",
	"New Skills",
	"New Agents",
	"New Commands",
	"CLI",
	"Features",
	"Improvements",
	"Removals",
	"Bug Fixes",
	"Migration Notes",
];
// A change here reaches users (the kit, the binary or the installers), so it needs a fragment.
const SHIPPED = [/^\.claude\//, /^kit\//, /^crates\//, /^install\.(sh|ps1)$/, /^\.meowkit\//];

function git(args) {
	return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Fragment file names (relative to `changes/`), README excluded, sorted for stable output. */
function fragmentFiles() {
	if (!fs.existsSync(CHANGES_DIR)) return [];
	return fs
		.readdirSync(CHANGES_DIR)
		.filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
		.sort();
}

/** Parses one fragment; throws with the file name on a bad section or an empty body. */
function parseFragment(name, text) {
	const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
	if (!m) throw new Error(`changes/${name}: missing the --- frontmatter --- block`);
	const section = (/^section:\s*(.+?)\s*$/m.exec(m[1]) || [])[1];
	if (!SECTIONS.includes(section)) {
		throw new Error(`changes/${name}: section "${section ?? ""}" is not one of: ${SECTIONS.join(", ")}`);
	}
	const body = m[2].trim();
	if (!body) throw new Error(`changes/${name}: empty body`);
	return { name, section, body };
}

/** Markdown for fragments grouped by section in schema order; `level` is the heading depth. */
function render(fragments, level = "###") {
	const out = [];
	for (const section of SECTIONS) {
		const items = fragments.filter((f) => f.section === section);
		if (items.length === 0) continue;
		out.push(`${level} ${section}`, "", ...items.map((f) => f.body), "");
	}
	return out.join("\n").trim();
}

/** The body of the `## <version> (...)` section, without its heading; null when absent. */
function extractSection(changelog, version) {
	const lines = changelog.split("\n");
	const start = lines.findIndex((l) => l.startsWith(`## ${version} (`));
	if (start < 0) return null;
	let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
	if (end < 0) end = lines.length;
	return lines
		.slice(start + 1, end)
		.join("\n")
		.trim();
}

/** Inserts a version section before the first released version heading of the changelog. */
function insertSection(changelog, version, date, body) {
	if (new RegExp(`^## ${version.replace(/\./g, "\\.")} \\(`, "m").test(changelog)) {
		throw new Error(`the changelog already has a ## ${version} section`);
	}
	const idx = changelog.search(/^## \d+\.\d+\.\d+/m);
	const section = `## ${version} (${date})\n\n${body}\n\n`;
	if (idx < 0) return `${changelog.trimEnd()}\n\n${section}`;
	return changelog.slice(0, idx) + section + changelog.slice(idx);
}

function loadAll(names = fragmentFiles()) {
	return names.map((n) => parseFragment(n, fs.readFileSync(path.join(CHANGES_DIR, n), "utf8")));
}

function argValue(args, flag) {
	const i = args.indexOf(flag);
	return i >= 0 ? args[i + 1] : undefined;
}

function main(argv) {
	const [mode, ...rest] = argv;
	if (mode === "check") {
		const all = loadAll();
		console.log(`changelog fragments valid: ${all.length}`);
		return;
	}
	if (mode === "notes") {
		const since = argValue(rest, "--since");
		let names = fragmentFiles();
		if (since) {
			const added = new Set(
				git(["diff", "--name-only", "--diff-filter=A", `${since}..HEAD`, "--", "changes/"])
					.split("\n")
					.filter(Boolean)
					.map((p) => path.basename(p)),
			);
			names = names.filter((n) => added.has(n));
		}
		process.stdout.write(`${render(loadAll(names)) || "No user-visible changes recorded."}\n`);
		return;
	}
	if (mode === "stable") {
		const version = rest[0];
		if (!/^\d+\.\d+\.\d+$/.test(version || "")) throw new Error("stable needs an X.Y.Z version");
		const date = argValue(rest, "--date") || new Date().toISOString().slice(0, 10);
		const names = fragmentFiles();
		const body = render(loadAll(names)) || "Maintenance release: no user-visible changes.";
		fs.writeFileSync(CHANGELOG, insertSection(fs.readFileSync(CHANGELOG, "utf8"), version, date, body));
		for (const n of names) fs.rmSync(path.join(CHANGES_DIR, n));
		console.log(`changelog: added ## ${version} (${date}) from ${names.length} fragment(s)`);
		return;
	}
	if (mode === "section") {
		const body = extractSection(fs.readFileSync(CHANGELOG, "utf8"), rest[0] || "");
		if (body === null) throw new Error(`the changelog has no ## ${rest[0]} section`);
		process.stdout.write(`${body}\n`);
		return;
	}
	if (mode === "require") {
		const base = argValue(rest, "--base");
		if (!base) throw new Error("require needs --base <git-ref>");
		const changed = git(["diff", "--name-only", `${base}...HEAD`])
			.split("\n")
			.filter(Boolean);
		const shipped = changed.filter((p) => SHIPPED.some((re) => re.test(p)));
		const added = git(["diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`, "--", "changes/"])
			.split("\n")
			.filter((p) => p.endsWith(".md") && !/readme\.md$/i.test(p));
		if (shipped.length > 0 && added.length === 0) {
			throw new Error(
				`this change touches shipped files (${shipped.slice(0, 3).join(", ")}${shipped.length > 3 ? ", …" : ""}) ` +
					"but adds no changes/*.md fragment. Add one (see changes/README.md) or label the PR no-changelog.",
			);
		}
		loadAll(added.map((p) => path.basename(p)).filter((n) => fs.existsSync(path.join(CHANGES_DIR, n))));
		console.log(`changelog fragment check passed (${added.length} fragment(s), ${shipped.length} shipped file(s))`);
		return;
	}
	throw new Error(
		"usage: assemble-changelog.cjs <check|notes [--since ref]|stable X.Y.Z [--date d]|section X.Y.Z|require --base ref>",
	);
}

if (require.main === module) {
	try {
		main(process.argv.slice(2));
	} catch (err) {
		console.error(`assemble-changelog: ${err.message}`);
		process.exit(1);
	}
}

module.exports = { SECTIONS, parseFragment, render, insertSection, extractSection };
