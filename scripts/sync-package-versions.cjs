#!/usr/bin/env node
/**
 * Synchronize version across both workspace packages.
 * Called by semantic-release exec plugin before npm publish.
 *
 * Usage: node scripts/sync-package-versions.cjs <version>
 */

const fs = require("fs");
const path = require("path");

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/sync-package-versions.cjs <version>");
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version format: ${version}`);
  process.exit(1);
}

const PACKAGES = [
  path.join(__dirname, "..", "packages", "meowkit", "package.json"),
];

for (const pkgPath of PACKAGES) {
  if (!fs.existsSync(pkgPath)) {
    console.warn(`Warning: ${pkgPath} not found, skipping`);
    continue;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const oldVersion = pkg.version;
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log(`${pkg.name}: ${oldVersion} -> ${version}`);
}

console.log(`Synced ${PACKAGES.length} packages to v${version}`);
