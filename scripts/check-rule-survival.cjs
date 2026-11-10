#!/usr/bin/env node
// Rule-survival check: compressing the always-on rules must never delete safety text.
// Every item of the pinned oracle (scripts/rule-survival-oracle.cjs) must appear somewhere
// in the 7 always-on rule files — an item may live in any of them.
//
// Usage: node scripts/check-rule-survival.cjs [project-root]
//   exit 0  every oracle item found
//   exit 1  at least one item missing (each missing item is named)
//   exit 2  the rules directory or one of the 7 always-on files is missing/unreadable

const fs = require("node:fs");
const path = require("node:path");

const { ORACLE, ALWAYS_ON_FILES } = require("./rule-survival-oracle.cjs");

/** Collapse whitespace runs so re-wrapping or table re-padding cannot hide a deletion. */
function normalize(text) {
	return text.replace(/\s+/g, " ");
}

function loadAlwaysOnText(rulesDir) {
	const parts = ALWAYS_ON_FILES.map((name) => fs.readFileSync(path.join(rulesDir, name), "utf8"));
	return normalize(parts.join("\n"));
}

function main(argv) {
	const root = path.resolve(argv[2] || process.cwd());
	const rulesDir = path.join(root, ".claude", "rules");

	let haystack;
	try {
		haystack = loadAlwaysOnText(rulesDir);
	} catch (error) {
		console.error(`check-rule-survival: cannot read the always-on set under ${rulesDir}: ${error.message}`);
		return 2;
	}

	const missing = [];
	for (const item of ORACLE) {
		if (!haystack.includes(normalize(item.needle))) {
			missing.push(item.name);
		}
	}

	console.log(`rule-survival: ${ORACLE.length} pinned item(s) checked against ${ALWAYS_ON_FILES.length} always-on file(s) in ${rulesDir}`);
	if (missing.length > 0) {
		console.error(`FAIL: ${missing.length} pinned item(s) missing from the always-on set:`);
		for (const name of missing) {
			console.error(`  MISSING: ${name}`);
		}
		return 1;
	}
	console.log("OK: every pinned safety item survives.");
	return 0;
}

if (require.main === module) {
	process.exit(main(process.argv));
}

module.exports = { main, normalize };
