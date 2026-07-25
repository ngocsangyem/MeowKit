#!/usr/bin/env node
// Copy each authored provider bundle's DATA into dist so it ships in the npm package.
//
// `tsc` compiles only `.ts` → `.js`; each provider's bundle under
// `src/migrate/modules/<provider>/` is DATA (manifest.json, catalog/*.json,
// compliance/*.json, root/**) and is excluded from compilation, so it would never reach
// `dist/` on its own. But `resolve<Provider>ModuleDir()` resolves each bundle at
// `dist/migrate/modules/<provider>/` at runtime — so a published install (`init --target
// <provider>`) needs the data copied there explicitly. Runs after `tsc` in `build:cli`.
//
// One loop over every authored bundle instead of one script per provider — a new authored
// bundle adds an entry to PROVIDERS, not a new copy script.
const { cpSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const PROVIDERS = ["codex", "cursor"];

// Exclude Python build artifacts (untracked, regenerated on run; binary `.pyc` blobs would
// otherwise ship into the published package). Mirrors `isBundleBuildArtifact` in
// codex-authored-bundle.ts / cursor-authored-bundle.ts.
const isBuildArtifact = (p) => {
	const norm = p.split("\\").join("/");
	return /(?:^|\/)__pycache__(?:\/|$)/.test(norm) || norm.endsWith(".pyc");
};

for (const provider of PROVIDERS) {
	const src = join(__dirname, "..", "src", "migrate", "modules", provider);
	const dest = join(__dirname, "..", "dist", "migrate", "modules", provider);

	if (!existsSync(src)) {
		console.error(`[copy-provider-bundles] source missing: ${src}`);
		process.exit(1);
	}
	cpSync(src, dest, { recursive: true, filter: (s) => !isBuildArtifact(s) });
	console.log(`[copy-provider-bundles] copied ${provider} bundle → dist/migrate/modules/${provider}`);
}
