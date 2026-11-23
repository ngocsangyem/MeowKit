#!/usr/bin/env node
/**
 * Copy the kit this checkout would publish (the ship set every release archive
 * is built from) into an empty directory, so the binary release gate can run
 * `mewkit init` against exactly the candidate kit before it is tagged.
 *
 * Usage: node scripts/release/stage-candidate-kit.cjs <outDir>
 */
const fs = require("fs");
const path = require("path");
const { excludeMatcher, shipSetExclusions, shipSetFiles } = require("../kit-ship-set.cjs");

const out = process.argv[2];
if (!out) {
	console.error("usage: stage-candidate-kit.cjs <outDir>");
	process.exit(2);
}
const root = path.resolve(__dirname, "../..");
try {
	if (fs.existsSync(out) && fs.readdirSync(out).length > 0) throw new Error(`${out} is not empty`);
	const files = shipSetFiles(root, excludeMatcher(shipSetExclusions(root)));
	if (files.length === 0) throw new Error("the ship set is empty");
	for (const rel of files) {
		const dest = path.join(out, rel);
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.copyFileSync(path.join(root, rel), dest);
	}
	console.log(`staged ${files.length} kit files in ${out}`);
} catch (error) {
	console.error(`stage-candidate-kit: ${error.message}`);
	process.exit(1);
}
