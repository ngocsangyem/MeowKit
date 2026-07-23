#!/usr/bin/env node
// Copy the authored Codex bundle DATA into dist so it ships in the npm package.
//
// `tsc` compiles only `.ts` → `.js`; the Codex bundle under
// `src/migrate/modules/codex/` is DATA (AGENTS.md, config.toml, hooks.json, hooks/,
// agents/*.toml, skills/**, manifest.json) and is excluded from compilation, so it
// would never reach `dist/`. But `resolveCodexModuleDir()` resolves the bundle at
// `dist/migrate/modules/codex/` at runtime — so a published install (`init --target
// codex`) needs the data copied there explicitly. Runs after `tsc` in `build:cli`.
const { cpSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const src = join(__dirname, "..", "src", "migrate", "modules", "codex");
const dest = join(__dirname, "..", "dist", "migrate", "modules", "codex");

if (!existsSync(src)) {
	console.error(`[copy-codex-bundle] source missing: ${src}`);
	process.exit(1);
}
cpSync(src, dest, { recursive: true });
console.log(`[copy-codex-bundle] copied Codex bundle → dist/migrate/modules/codex`);
