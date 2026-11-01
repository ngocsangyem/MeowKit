#!/usr/bin/env node
// Zero-residue check for the memory diet: the shipped kit (`.claude/`) and the CLI source
// (`packages/mewkit/src/`) must carry no reference to the deleted wiki, the deleted JSON
// memory stores, their generated views, the capture hook, or the relocated artifact paths.
//
// Tests and release history are excluded: a test may legitimately assert that a token is
// ABSENT, and a changelog records what was removed.
//
// Usage: node scripts/check-memory-wiki-residue.cjs
//   prints `file:line: <match>` per hit and exits 1 when there is any hit.

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");

const SCAN_ROOTS = [".claude", path.join("packages", "mewkit", "src")];

const RESIDUE_SOURCE = [
	"mewkit wiki",
	"mk:wiki",
	"knowledgeRecall",
	"fixes\\.json",
	"review-patterns\\.json",
	"architecture-decisions\\.json",
	"security-findings\\.json",
	"render-views",
	"seed-from-md",
	"memory-read-rules",
	"wiki-context-rules",
	"immediate-capture",
	"##(pattern|decision|note):",
	"\\.meowkit/memory/(docs-cache|qa-reports|retros|projects|security-reports|contributor-logs|freeze-dir)",
	"wiki-index\\.db",
	"scan-patterns",
].join("|");

/** Non-global on purpose: one reported match per line is enough to locate the residue. */
const RESIDUE = new RegExp(RESIDUE_SOURCE);

/** Excluded: test trees and release history (both legitimately name removed tokens). */
function isExcluded(relPath) {
	const parts = relPath.split(path.sep);
	if (parts.includes("__tests__") || parts.includes("tests")) return true;
	if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(relPath)) return true;
	const base = path.basename(relPath).toLowerCase();
	if (base.startsWith("changelog") || base.startsWith("release-notes")) return true;
	return false;
}

/** Binary artifacts are never grepped. */
const SKIP_EXT = new Set([
	".db",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webm",
	".mp4",
	".ico",
	".woff",
	".woff2",
	".zip",
	".pdf",
]);

function walk(dir, out) {
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name === ".git") continue;
			walk(full, out);
		} else if (entry.isFile()) {
			if (SKIP_EXT.has(path.extname(entry.name).toLowerCase())) continue;
			out.push(full);
		}
	}
	return out;
}

function collectHits() {
	const hits = [];
	for (const root of SCAN_ROOTS) {
		const abs = path.join(REPO_ROOT, root);
		if (!fs.existsSync(abs)) continue;
		for (const file of walk(abs, [])) {
			const rel = path.relative(REPO_ROOT, file);
			if (isExcluded(rel)) continue;
			let body;
			try {
				body = fs.readFileSync(file, "utf-8");
			} catch {
				continue;
			}
			if (!RESIDUE.test(body)) continue;
			const lines = body.split("\n");
			for (let i = 0; i < lines.length; i++) {
				const match = RESIDUE.exec(lines[i]);
				if (match) hits.push(`${rel}:${i + 1}: ${match[0]}`);
			}
		}
	}
	return hits;
}

function main() {
	const hits = collectHits();
	if (hits.length === 0) {
		console.log("memory/wiki residue check: 0 hits.");
		return 0;
	}
	for (const hit of hits) console.log(hit);
	console.error(`\nmemory/wiki residue check: ${hits.length} hit(s) — remove them before shipping.`);
	return 1;
}

process.exit(main());
