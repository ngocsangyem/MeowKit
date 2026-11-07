#!/usr/bin/env node
// Always-on context budget: the rules a session loads on every turn must stay small.
// Measured set: every `.md` at any depth under `<root>/.claude/rules/`.
// Limit: 25600 bytes (25 KiB), a fixed literal so the budget cannot drift silently.
//
// Usage: node scripts/check-always-on-budget.cjs [project-root]
//   exit 0  total <= limit (total printed)
//   exit 1  total >  limit (total and overage printed)
//   exit 2  the rules directory is missing or unreadable

const fs = require("node:fs");
const path = require("node:path");

const LIMIT_BYTES = 25600;

/** @returns {string[]} every `.md` file under dir, at any depth, sorted for stable output. */
function collectMarkdown(dir) {
	const found = [];
	const stack = [dir];
	while (stack.length > 0) {
		const current = stack.pop();
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) {
				stack.push(full);
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				found.push(full);
			}
		}
	}
	return found.sort();
}

function main(argv) {
	const root = path.resolve(argv[2] || process.cwd());
	const rulesDir = path.join(root, ".claude", "rules");

	let files;
	try {
		const stat = fs.statSync(rulesDir);
		if (!stat.isDirectory()) {
			console.error(`check-always-on-budget: not a directory: ${rulesDir}`);
			return 2;
		}
		files = collectMarkdown(rulesDir);
	} catch (error) {
		console.error(`check-always-on-budget: cannot read ${rulesDir}: ${error.message}`);
		return 2;
	}

	const sizes = [];
	for (const file of files) {
		try {
			sizes.push(fs.statSync(file).size);
		} catch (error) {
			console.error(`check-always-on-budget: cannot read ${file}: ${error.message}`);
			return 2;
		}
	}
	const total = sizes.reduce((sum, size) => sum + size, 0);

	console.log(`always-on rules: ${files.length} file(s) under ${rulesDir}`);
	files.forEach((file, i) => console.log(`  ${sizes[i]}\t${path.relative(root, file)}`));
	console.log(`measured total: ${total} bytes (limit ${LIMIT_BYTES})`);

	if (total > LIMIT_BYTES) {
		console.error(
			`FAIL: always-on rules are ${total - LIMIT_BYTES} bytes over the ${LIMIT_BYTES}-byte budget.`,
		);
		return 1;
	}
	console.log(`OK: ${LIMIT_BYTES - total} bytes of headroom.`);
	return 0;
}

if (require.main === module) {
	process.exit(main(process.argv));
}

module.exports = { main, LIMIT_BYTES };
