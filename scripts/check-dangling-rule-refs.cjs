#!/usr/bin/env node
// Dangling-reference check: every rule that moved out of an always-listed rules
// directory must leave no reference behind, and every one that kept a destination file must still be
// loaded from somewhere. Three rules (data in ./dangling-rule-refs-data.cjs):
//
//   (a) 0 matches of `rules/<moved>.md` or `rules-conditional/<moved>.md` anywhere
//       in the scan roots
//   (b) inside `.claude/` and the provider bundles, a bare `<moved>.md` mention is only
//       allowed as part of a path to that file's new location; a bare mention of an
//       inlined/merged rule or of the source-repo-only contract is always stale. Rules
//       flagged `citedByName` are exempt from (b): they are dispatched by name and then
//       cited by name in prose, so a bare mention there is a citation, not a path.
//   (c) every moved file with a destination is named by >=1 load step; the inlined
//       step-file contract is proven by the marker in all 5 step-filed workflows
//   (d) a retired directory or non-rule file (the tombstones) is named only on a
//       line that also names its current location — a mapping line, which is a
//       reference a reader can follow rather than a dangling one
//
// Usage: node scripts/check-dangling-rule-refs.cjs [repo-root]
//   exit 0  no dangling reference, every destination loaded
//   exit 1  at least one violation (each is printed with file:line)
//   exit 2  the repo root is missing or unreadable

const fs = require("node:fs");
const path = require("node:path");

const data = require("./dangling-rule-refs-data.cjs");

const PREFIXED_RE = new RegExp(`rules(?:-conditional)?/(${data.MOVED.map((m) => m.name).join("|")})\\.md`);
const BUNDLE_PREFIX = "packages/mewkit/src/migrate/modules/";

/** Repo-relative POSIX path of every readable text file under the scan roots. */
function collectFiles(root) {
	const out = [];
	const pushFile = (rel) => {
		if (data.TEXT_EXTENSIONS.includes(path.extname(rel))) out.push(rel);
	};
	const walk = (rel) => {
		for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
			const child = `${rel}/${entry.name}`;
			if (data.PRUNED_SEGMENTS.includes(entry.name)) continue;
			if (data.PRUNED_PREFIXES.some((p) => child.startsWith(p))) continue;
			if (entry.isDirectory()) walk(child);
			else if (entry.isFile()) pushFile(child);
		}
	};
	for (const target of data.ROOTS) {
		const abs = path.join(root, target.path);
		if (!fs.existsSync(abs)) continue;
		if (target.kind === "dir") walk(target.path);
		else pushFile(target.path);
	}
	return out;
}

function exemptionFor(rel) {
	return data.EXEMPT.find((e) => rel.startsWith(e.match));
}

/** (b) applies to shipped prose: `.claude/` and the mirrored provider bundles. */
function isShippedProse(rel) {
	return rel.startsWith(".claude/") || rel.startsWith(BUNDLE_PREFIX);
}

/**
 * A bare `<name>.md` hit is fine when the line spells out that file's new location: either
 * the characters immediately before it complete the path, or every segment of the new path
 * appears on the line in order (how resolution code builds a path segment by segment).
 */
function pointsAtNewLocation(line, index, moved) {
	if (!moved.to) return false;
	const segments = moved.to.split("/");
	// The parent directory alone is enough: any full-path prefix also ends with it.
	const parentDir = segments[segments.length - 2];
	if (line.slice(0, index).endsWith(`${parentDir}/`)) return true;
	let cursor = 0;
	for (const segment of segments) {
		const at = line.indexOf(segment, cursor);
		if (at === -1) return false;
		cursor = at + segment.length;
	}
	return true;
}

function scan(root, files) {
	const violations = [];
	const destinationHits = new Map(data.MOVED.filter((m) => m.to).map((m) => [m.name, 0]));

	for (const rel of files) {
		const exempt = exemptionFor(rel);
		let body;
		try {
			body = fs.readFileSync(path.join(root, rel), "utf8");
		} catch (error) {
			violations.push({ rel, line: 0, detail: `unreadable: ${error.message}` });
			continue;
		}
		const lines = body.split("\n");
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i];
			for (const moved of data.MOVED) {
				if (moved.to && line.includes(moved.to)) destinationHits.set(moved.name, destinationHits.get(moved.name) + 1);
			}
			if (exempt) continue;
			const prefixed = PREFIXED_RE.exec(line);
			if (prefixed) {
				violations.push({ rel, line: i + 1, detail: `(a) old rule path: ${prefixed[0]}` });
			}
			for (const retired of data.RETIRED_PATHS) {
				if (line.includes(retired.path) && !line.includes(retired.to)) {
					violations.push({ rel, line: i + 1, detail: `(d) retired location: ${retired.path}` });
				}
			}
			if (!isShippedProse(rel)) continue;
			for (const moved of data.MOVED) {
				if (moved.citedByName) continue;
				const needle = `${moved.name}.md`;
				let at = line.indexOf(needle);
				while (at !== -1) {
					if (!pointsAtNewLocation(line, at, moved)) {
						const why = moved.inlined ? "merged into another file" : moved.to ? "not its new path" : "removed";
						violations.push({ rel, line: i + 1, detail: `(b) bare \`${needle}\` — ${why}` });
						break;
					}
					at = line.indexOf(needle, at + needle.length);
				}
			}
		}
	}
	return { violations, destinationHits };
}

/** (c) The inlined step-file contract must live in all 5 step-filed workflows. */
function checkStepFileInline(root) {
	const missing = [];
	for (const skill of data.STEP_FILE_WORKFLOWS) {
		const rel = path.join(".claude", "skills", skill, "workflow.md");
		const abs = path.join(root, rel);
		const body = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
		if (!body.includes(data.STEP_FILE_MARKER)) missing.push(rel);
	}
	return missing;
}

function main(argv) {
	const root = path.resolve(argv[2] || process.cwd());
	let files;
	try {
		if (!fs.statSync(root).isDirectory()) {
			console.error(`check-dangling-rule-refs: not a directory: ${root}`);
			return 2;
		}
		files = collectFiles(root);
	} catch (error) {
		console.error(`check-dangling-rule-refs: cannot read ${root}: ${error.message}`);
		return 2;
	}

	const { violations, destinationHits } = scan(root, files);
	const unloaded = [...destinationHits].filter(([, hits]) => hits === 0).map(([name]) => name);
	const stepFileMissing = checkStepFileInline(root);

	console.log(`dangling-rule-refs: ${files.length} file(s) scanned under ${root}`);
	for (const v of violations) console.error(`  ${v.rel}:${v.line}: ${v.detail}`);
	for (const name of unloaded) console.error(`  (c) no load step references the new location of ${name}`);
	for (const rel of stepFileMissing) console.error(`  (c) ${rel} is missing the inlined step-file contract`);

	const total = violations.length + unloaded.length + stepFileMissing.length;
	if (total > 0) {
		console.error(`FAIL: ${total} dangling-reference violation(s).`);
		return 1;
	}
	console.log(
		`OK: no dangling references; all ${destinationHits.size} destinations are loaded, ` +
			`${data.RETIRED_PATHS.length} retired locations unreferenced.`,
	);
	return 0;
}

if (require.main === module) {
	process.exit(main(process.argv));
}

module.exports = { main, collectFiles, scan, checkStepFileInline };
