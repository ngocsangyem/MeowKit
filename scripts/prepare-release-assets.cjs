#!/usr/bin/env node
/**
 * Prepare release assets for semantic-release publish step.
 * Generates metadata.json, release manifest, and optional zip archive.
 *
 * Usage: node scripts/prepare-release-assets.cjs <version>
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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
const claudeDir = path.join(projectRoot, ".claude");
const metadataPath = path.join(claudeDir, "metadata.json");
const distDir = path.join(projectRoot, "dist");
const archivePath = path.join(distDir, "meowkit-release.zip");

try {
  // Step 1: Read package.json for metadata
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")
  );

  // Step 2: Generate .claude/metadata.json
  let existing = {};
  if (fs.existsSync(metadataPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    } catch {
      console.warn("Warning: could not parse existing metadata.json, starting fresh");
    }
  }

  const metadata = {
    ...existing,
    version,
    name: "meowkit",
    description: packageJson.description || "AI agent toolkit for Claude Code",
    buildDate: new Date().toISOString(),
    repository: packageJson.repository || { type: "git", url: "https://github.com/meowkit/meowkit" },
  };

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");
  console.log(`Generated metadata.json v${version}`);

  // Step 3: Generate release manifest
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

  const archiveTargets = [
    ".claude",
    "tasks",
    "CLAUDE.md",
    "release-manifest.json",
  ].filter((t) => fs.existsSync(path.join(projectRoot, t)));

  if (archiveTargets.length === 0) {
    throw new Error("No release assets found");
  }

  // Validate critical assets
  for (const critical of [".claude", "release-manifest.json"]) {
    if (!fs.existsSync(path.join(projectRoot, critical))) {
      throw new Error(`Critical asset missing: ${critical}`);
    }
  }

  // Exclude runtime dirs that shouldn't be in release
  const excludes = [
    "-x", ".claude/session-state/*",
    "-x", ".claude/memory/*",
    "-x", ".claude/logs/*",
    "-x", ".claude/skills/.venv/*",
    "-x", ".claude/metadata.json",
    "-x", ".claude/.env",
    "-x", "*.pyc",
    "-x", "__pycache__/*",
  ];
  execSync(`zip -r ${archivePath} ${archiveTargets.join(" ")} ${excludes.join(" ")}`, { stdio: "inherit" });
  console.log(`Prepared ${archivePath}`);
} catch (error) {
  console.error(`Failed to prepare release assets: ${error.message}`);
  process.exit(1);
}
