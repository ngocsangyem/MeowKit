#!/usr/bin/env node
/**
 * Prepare the kit release assets uploaded by scripts/release.sh: the release manifest,
 * dist/meowkit-release.zip and dist/checksums.txt (SHA-256 of the zip).
 *
 * Usage: node scripts/prepare-release-assets.cjs <version>
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync, spawnSync } = require("child_process");
const { ARCHIVE_TARGETS, CRITICAL_TARGETS, shipSetExclusions, zipExcludeArgs } = require("./kit-ship-set.cjs");

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/prepare-release-assets.cjs <version>");
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version format: ${version}`);
  process.exit(1);
}

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const archivePath = path.join(distDir, "meowkit-release.zip");
const checksumsPath = path.join(distDir, "checksums.txt");

try {
  // Release identity is carried by release-manifest.json. The installed
  // .claude/metadata.json is written by the CLI on install/upgrade, never
  // shipped in the archive, so the release pipeline does not generate it here.

  // Generate release manifest
  execSync(`node scripts/generate-release-manifest.cjs "${version}"`, { stdio: "inherit" });

  // Validate manifest exists
  const manifestPath = path.join(projectRoot, "release-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("release-manifest.json was not created");
  }
  JSON.parse(fs.readFileSync(manifestPath, "utf8")); // validate JSON
  console.log("Validated release-manifest.json");

  // Step 4: Create zip archive for GitHub Release
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  for (const stale of [archivePath, checksumsPath]) {
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
  }

  // `.meowkit/pack-manifest.json` is named as a single file, never as a directory: the rest
  // of `.meowkit/` is per-project state including `.env`, and must never reach an archive.
  const archiveTargets = ARCHIVE_TARGETS.filter((t) => fs.existsSync(path.join(projectRoot, t)));

  if (archiveTargets.length === 0) {
    throw new Error("No release assets found");
  }

  // Validate critical assets
  for (const critical of CRITICAL_TARGETS) {
    if (!fs.existsSync(path.join(projectRoot, critical))) {
      throw new Error(`Critical asset missing: ${critical}`);
    }
  }

  // Exclusions come from the pack manifest's `base.exclude`, which the kit
  // artifact build reads too. Patterns are passed as separate args (no shell) so
  // glob expansion is done by zip's matcher, not by the shell — `*` then
  // correctly crosses `/`, which is the semantics the shared matcher implements.
  const excludes = zipExcludeArgs(shipSetExclusions(projectRoot));
  const zipResult = spawnSync(
    "zip",
    ["-r", archivePath, ...archiveTargets, ...excludes],
    { stdio: "inherit" }
  );
  if (zipResult.status !== 0) {
    throw new Error(`zip exited with status ${zipResult.status}`);
  }
  console.log(`Prepared ${archivePath}`);

  // `sha256sum -c` format, so a user can verify a download with standard tools.
  const digest = crypto.createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex");
  fs.writeFileSync(checksumsPath, `${digest}  ${path.basename(archivePath)}\n`, "utf8");
  console.log(`Prepared ${checksumsPath}`);
} catch (error) {
  console.error(`Failed to prepare release assets: ${error.message}`);
  process.exit(1);
}
