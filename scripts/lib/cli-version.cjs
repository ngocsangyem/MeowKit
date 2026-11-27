"use strict";
// The `mewkit` binary's version: `[workspace.package]` in the root Cargo.toml, which every
// crate inherits. It always equals the kit version in root package.json (one version for
// both); scripts/sync-versions.cjs stamps it and fails on drift.

const fs = require("node:fs");
const path = require("node:path");

/** The `version` in the root Cargo.toml's `[workspace.package]` table, or null when absent. */
function cliVersion(root) {
	const text = fs.readFileSync(path.join(root, "Cargo.toml"), "utf8");
	const table = text.split(/^\[/m).find((section) => section.startsWith("workspace.package]"));
	const match = table && table.match(/^version\s*=\s*"([^"]+)"/m);
	return match ? match[1] : null;
}

module.exports = { cliVersion };
