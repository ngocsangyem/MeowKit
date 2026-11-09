#!/usr/bin/env node
/**
 * check-node-only-runtime.cjs — prove the kit's shared executables need node and nothing else.
 *
 * Three claims, all read off the SHIPPED file set rather than the working tree,
 * because the property is about what a user receives:
 *
 *   1. The kit's former shared script directory ships nothing. Its contents were
 *      redistributed to the hook library, to the skills that own them, and to
 *      this repository; a file reappearing there is a residue, not a decision.
 *   2. Inside the node-only trees, no file is named `.py` or `.sh` AND no file's
 *      first line names an interpreter other than node. The shebang is the test,
 *      not the extension: the shared executables carry no extension at all, so an
 *      extension check would have missed every one of them.
 *   3. Every skill-owned interpreter script that shipped before the
 *      redistribution still lives at exactly the same path. Those scripts are
 *      the reason the per-skill environment provisioning exists, and a
 *      redistribution that removed one would read as a tidy-up in the diff. The
 *      list is split by where the claim is checked: most must still SHIP from
 *      their path, while the ones owned by a skill the kit withholds must still
 *      EXIST in the repository and must not ship.
 *
 * Usage: node scripts/check-node-only-runtime.cjs [repo-root]
 * Exit:  0 all three hold; 1 a claim failed; 2 a precondition failed.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { excludeMatcher, shipSetExclusions, shipSetFiles } = require("./kit-ship-set.cjs");
const {
	NODE_ONLY_TREES,
	RETAINED_SKILL_SCRIPTS,
	RETAINED_UNSHIPPED_SKILL_SCRIPTS,
} = require("./lib/node-only-runtime-data.cjs");

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, ".."));

/** A shebang's interpreter basename, or null when the file has no shebang. */
function interpreter(absolute) {
	let head;
	try {
		const handle = fs.openSync(absolute, "r");
		const buffer = Buffer.alloc(256);
		const read = fs.readSync(handle, buffer, 0, 256, 0);
		fs.closeSync(handle);
		head = buffer.subarray(0, read).toString("utf8").split("\n")[0];
	} catch {
		return null;
	}
	if (!head.startsWith("#!")) return null;
	// `#!/usr/bin/env node --flag` and `#!/usr/bin/node` both answer "node".
	const words = head.slice(2).trim().split(/\s+/).filter((w) => w !== "" && !w.startsWith("-"));
	const named = words.filter((w) => !w.endsWith("/env") && w !== "env");
	return path.basename(named[0] ?? words[0] ?? "");
}

function main() {
	let patterns;
	try {
		patterns = shipSetExclusions(ROOT);
	} catch (error) {
		process.stderr.write(`precondition: ${error.message}\n`);
		process.exit(2);
	}
	const shipped = shipSetFiles(ROOT, excludeMatcher(patterns));
	if (shipped.length === 0) {
		process.stderr.write("precondition: the ship set is empty — nothing to check\n");
		process.exit(2);
	}

	const problems = [];

	const residue = shipped.filter((rel) => rel.startsWith(".claude/scripts/"));
	for (const rel of residue) problems.push(`${rel} ships from the redistributed script directory`);

	let scanned = 0;
	for (const rel of shipped) {
		if (!NODE_ONLY_TREES.some((tree) => rel.startsWith(`${tree}/`))) continue;
		scanned += 1;
		if (/\.(py|sh)$/.test(rel)) {
			problems.push(`${rel} is an interpreter script inside a node-only tree`);
			continue;
		}
		const named = interpreter(path.join(ROOT, rel));
		if (named !== null && named !== "node") {
			problems.push(`${rel} has a '#!' naming ${named}, not node`);
		}
	}
	if (scanned === 0) problems.push(`no shipped file lies under ${NODE_ONLY_TREES.join(" or ")} — the scan proved nothing`);

	const shippedSet = new Set(shipped);
	for (const rel of RETAINED_SKILL_SCRIPTS) {
		if (!shippedSet.has(rel)) problems.push(`${rel} no longer ships from its own path`);
	}
	// The withheld half is checked against the repository: the artifact is not
	// supposed to carry these, but they must still exist for the maintainer who
	// runs them from the checkout.
	for (const rel of RETAINED_UNSHIPPED_SKILL_SCRIPTS) {
		if (!fs.existsSync(path.join(ROOT, rel))) problems.push(`${rel} no longer exists in the repository`);
		if (shippedSet.has(rel)) problems.push(`${rel} ships, but its skill is withheld from the kit`);
	}

	if (problems.length > 0) {
		process.stderr.write("Node-only runtime check FAILED\n");
		for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
		process.exit(1);
	}

	console.log("Node-only runtime check");
	console.log(`  ok    no shipped file under .claude/scripts/`);
	console.log(`  ok    ${scanned} shipped file(s) in the node-only trees, none interpreter-dependent`);
	console.log(`  ok    ${RETAINED_SKILL_SCRIPTS.length} skill-owned interpreter script(s) still ship from their own paths`);
	console.log(
		`  ok    ${RETAINED_UNSHIPPED_SKILL_SCRIPTS.length} skill-owned interpreter script(s) kept in the repository, withheld from the kit`,
	);
}

main();
