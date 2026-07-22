#!/usr/bin/env node
/**
 * Prepare release assets for semantic-release publish step.
 * Generates the release manifest and the zip archive.
 *
 * Usage: node scripts/prepare-release-assets.cjs <version>
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

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
  if (fs.existsSync(archivePath)) {
    fs.unlinkSync(archivePath);
  }

  const archiveTargets = [".claude", "tasks", "CLAUDE.md", "release-manifest.json"].filter((t) =>
    fs.existsSync(path.join(projectRoot, t)),
  );

  if (archiveTargets.length === 0) {
    throw new Error("No release assets found");
  }

  // Validate critical assets
  for (const critical of [".claude", "release-manifest.json"]) {
    if (!fs.existsSync(path.join(projectRoot, critical))) {
      throw new Error(`Critical asset missing: ${critical}`);
    }
  }

  // Exclude runtime dirs that shouldn't be in release.
  // Patterns are passed as separate args (no shell) so glob expansion is done
  // by zip's matcher, not by the shell — `*` then correctly crosses `/`.
  const excludes = [
    "-x", ".claude/session-state/*",
    "-x", ".claude/memory/*",
    "-x", ".claude/logs/*",
    "-x", ".claude/skills/.venv/*",
    // Defensive guard: a stray installed metadata.json or .env on a dev machine
    // must never leak into a published archive (the pipeline no longer generates
    // metadata.json, but a local install might leave one behind).
    "-x", ".claude/metadata.json",
    "-x", ".claude/.env",
    "-x", "*.pyc",
    "-x", "__pycache__/*",
  ];
  const zipResult = spawnSync(
    "zip",
    ["-r", archivePath, ...archiveTargets, ...excludes],
    { stdio: "inherit" }
  );
  if (zipResult.status !== 0) {
    throw new Error(`zip exited with status ${zipResult.status}`);
  }
  console.log(`Prepared ${archivePath}`);
} catch (error) {
  console.error(`Failed to prepare release assets: ${error.message}`);
  process.exit(1);
}
