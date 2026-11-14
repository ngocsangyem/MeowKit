"use strict";
// The `mewkit` binary's version, which rides its own semver track apart from the kit's.
// Every crate inherits it from `[workspace.package]` in the root Cargo.toml, so that table
// is the one place to read it.

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
