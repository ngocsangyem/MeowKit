#!/usr/bin/env node
/**
 * Generate release manifest with SHA-256 checksums for all release assets.
 * Tracks .claude/, tasks/, and root config files.
 *
 * Usage: node scripts/generate-release-manifest.cjs [version]
 * Output: release-manifest.json in project root
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const INCLUDE_DIRS = [".claude", "tasks"];
const INCLUDE_FILES = ["CLAUDE.md"];

const SKIP_DIRS = new Set([
  "node_modules", ".venv", "venv", "__pycache__", ".git",
  "dist", "build", "logs", "memory", ".DS_Store",
]);

const SKIP_EXTENSIONS = new Set([".pyc", ".pyo", ".env"]);

/** Calculate SHA-256 checksum of a file */
function calculateChecksum(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/** Get last git commit timestamp for a file (null if untracked) */
function getGitTimestamp(filePath) {
  try {
    const result = execSync(`git log -1 --format="%cI" -- "${filePath}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

/** Recursively scan directory for files */
function scanDirectory(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith(".") && entry.name !== ".gitkeep") continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...scanDirectory(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SKIP_EXTENSIONS.has(ext)) continue;
      files.push(fullPath);
    }
  }
  return files;
}

function main() {
  const version = process.argv[2] || process.env.npm_package_version || "unknown";
  if (version !== "unknown" && !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    console.error(`Invalid version format: ${version}`);
    process.exit(1);
  }
  const projectRoot = process.cwd();
  const outputPath = path.join(projectRoot, "release-manifest.json");
  const tempPath = outputPath + ".tmp";

  console.log(`Generating release manifest v${version}...`);

  const allFiles = [];

  // Scan included directories
  for (const dir of INCLUDE_DIRS) {
    const dirPath = path.join(projectRoot, dir);
    if (fs.existsSync(dirPath)) {
      const files = scanDirectory(dirPath);
      allFiles.push(...files);
      console.log(`  ${dir}: ${files.length} files`);
    }
  }

  // Add root-level files
  for (const file of INCLUDE_FILES) {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
      allFiles.push(filePath);
    }
  }

  console.log(`Total files: ${allFiles.length}`);

  const manifest = {
    version,
    generatedAt: new Date().toISOString(),
    files: [],
  };

  for (const file of allFiles) {
    if (!fs.existsSync(file)) continue;

    let relativePath = path.relative(projectRoot, file).replace(/\\/g, "/");

    // Strip .claude/ prefix — CLI tracks files relative to .claude/
    if (relativePath.startsWith(".claude/")) {
      relativePath = relativePath.slice(".claude/".length);
    }

    const stats = fs.statSync(file);
    const entry = {
      path: relativePath,
      checksum: calculateChecksum(file),
      size: stats.size,
    };

    const timestamp = getGitTimestamp(file);
    if (timestamp) entry.lastModified = timestamp;

    manifest.files.push(entry);
  }

  // Atomic write
  fs.writeFileSync(tempPath, JSON.stringify(manifest, null, 2) + "\n");
  fs.renameSync(tempPath, outputPath);

  console.log(`Generated: ${outputPath} (${manifest.files.length} entries)`);
}

main();
