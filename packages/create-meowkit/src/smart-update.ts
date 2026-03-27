import {
  existsSync, readFileSync, readdirSync, statSync,
  mkdirSync, copyFileSync, chmodSync,
} from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import * as log from "./logger.js";
import { copyDirRecursive, resolveTemplateDir } from "./copy-template-tree.js";
import { processTemplate } from "./substitute-placeholders.js";
import { mergeSettingsFile } from "./merge-settings.js";
import {
  readManifest,
  buildManifest,
  writeManifest,
  hashFile,
  classifyLayer,
  type Manifest,
  type FileLayer,
} from "./compute-checksums.js";
import type { UserConfig } from "./prompts.js";

interface UpdateStats {
  updated: number;
  skipped: number;
  added: number;
  userModified: string[];
}

/**
 * Check if a .meowkitignore file protects a given path.
 * Simple glob-free matching: exact paths and directory prefixes.
 */
function isIgnored(relPath: string, targetDir: string): boolean {
  const ignorePath = join(targetDir, ".meowkitignore");
  if (!existsSync(ignorePath)) return false;

  const lines = readFileSync(ignorePath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  for (const pattern of lines) {
    // Exact match
    if (relPath === pattern) return true;
    // Directory prefix: "agents/" matches "agents/foo.md"
    if (pattern.endsWith("/") && relPath.startsWith(pattern)) return true;
    // Prefix without slash: ".claude/agents" matches ".claude/agents/foo.md"
    if (relPath.startsWith(pattern + "/")) return true;
  }
  return false;
}

/**
 * Smart update: compare existing files against manifest checksums.
 * - core layer: overwrite if user hasn't modified (checksum matches manifest)
 * - skill layer: same as core, per-file
 * - user layer: never overwrite
 * - new files: always copy
 * - .meowkitignore: skip protected files
 */
export async function smartUpdate(
  config: UserConfig,
  targetDir: string,
  dryRun: boolean,
  force = false
): Promise<UpdateStats> {
  const templateDir = resolveTemplateDir();
  const oldManifest = force ? null : readManifest(targetDir);
  const stats: UpdateStats = { updated: 0, skipped: 0, added: 0, userModified: [] };

  if (!oldManifest) {
    log.warn("No manifest found. Building fresh manifest from existing files...");
  }

  const oldChecksums = oldManifest?.checksums ?? {};

  // Build a map of what the NEW templates contain
  // We do this by temporarily scaffolding to a temp analysis
  // Instead, we compare template source checksums against what's on disk

  const claudeSrc = join(templateDir, "claude");
  if (!existsSync(claudeSrc)) {
    log.error(`Template directory not found: ${claudeSrc}`);
    process.exit(1);
  }

  // Collect all template files and their checksums
  function walkTemplates(dir: string, base: string): Array<{ relPath: string; srcPath: string }> {
    const results: Array<{ relPath: string; srcPath: string }> = [];
    const SKIP = new Set(["__pycache__", "node_modules", ".DS_Store"]);

    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry) || entry.endsWith(".pyc")) continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...walkTemplates(full, base));
      } else {
        results.push({ relPath: relative(base, full), srcPath: full });
      }
    }
    return results;
  }

  // Walk template .claude/ files
  const templateFiles = walkTemplates(claudeSrc, join(templateDir, "claude"))
    .map((f) => ({ ...f, relPath: `.claude/${f.relPath}` }));

  for (const { relPath, srcPath } of templateFiles) {
    const destPath = join(targetDir, relPath);
    const layer = classifyLayer(relPath);

    // Check .meowkitignore
    if (isIgnored(relPath, targetDir)) {
      log.debug(`Ignored (protected): ${relPath}`);
      stats.skipped++;
      continue;
    }

    // Special case: settings.json uses append-only merge
    if (relPath === ".claude/settings.json") {
      mergeSettingsFile(srcPath, destPath, dryRun);
      stats.updated++;
      continue;
    }

    // User layer: never overwrite
    if (layer === "user") {
      if (existsSync(destPath)) {
        log.debug(`Skipped (user layer): ${relPath}`);
        stats.skipped++;
      } else {
        copyFile(srcPath, destPath, dryRun);
        stats.added++;
      }
      continue;
    }

    // File doesn't exist yet → new file, always add
    if (!existsSync(destPath)) {
      copyFile(srcPath, destPath, dryRun);
      log.debug(`Added (new): ${relPath}`);
      stats.added++;
      continue;
    }

    // File exists — check if user modified it
    const currentHash = hashFile(destPath);
    const manifestEntry = oldChecksums[relPath];

    if (manifestEntry && currentHash !== manifestEntry.sha256) {
      // User modified this file — skip and warn
      log.debug(`Skipped (user-modified): ${relPath}`);
      stats.userModified.push(relPath);
      stats.skipped++;
      continue;
    }

    // File matches manifest (or no manifest) — safe to overwrite
    copyFile(srcPath, destPath, dryRun);
    stats.updated++;
  }

  // Process template files (CLAUDE.md, .meowkit.config.json) — user layer, skip if exists
  const claudeMdTemplate = join(templateDir, "claude-md.template");
  const claudeMdDest = join(targetDir, "CLAUDE.md");
  if (existsSync(claudeMdTemplate) && !existsSync(claudeMdDest)) {
    processTemplate(claudeMdTemplate, claudeMdDest, config, dryRun);
    stats.added++;
  }

  const configTemplate = join(templateDir, "meowkit-config.json.template");
  const configDest = join(targetDir, ".meowkit.config.json");
  if (existsSync(configTemplate) && !existsSync(configDest)) {
    processTemplate(configTemplate, configDest, config, dryRun);
    stats.added++;
  }

  // Copy static root files — skip if already exist (user layer)
  const staticFiles = [
    { src: "env.example", dest: ".env.example" },
    { src: "mcp.json.example", dest: ".mcp.json.example" },
    { src: "gitignore.meowkit", dest: ".gitignore.meowkit" },
  ];
  for (const { src, dest } of staticFiles) {
    const srcPath = join(templateDir, src);
    const destPath = join(targetDir, dest);
    if (existsSync(srcPath) && !existsSync(destPath)) {
      copyFile(srcPath, destPath, dryRun);
      stats.added++;
    }
  }

  // Write .env if Gemini API key provided and .env doesn't exist
  if (config.geminiApiKey && !existsSync(join(targetDir, ".env"))) {
    if (!dryRun) {
      const { writeFileSync: wf } = await import("node:fs");
      wf(
        join(targetDir, ".env"),
        `# MeowKit environment variables\nGEMINI_API_KEY=${config.geminiApiKey}\n`,
        "utf-8"
      );
    }
    stats.added++;
  }

  // Ensure empty dirs for memory/logs if enabled
  if (!dryRun) {
    if (config.enableMemory) {
      mkdirSync(join(targetDir, ".claude", "memory"), { recursive: true });
    }
    if (config.enableCostTracking) {
      mkdirSync(join(targetDir, ".claude", "logs"), { recursive: true });
    }
  }

  // Write updated manifest
  if (!dryRun) {
    const newManifest = buildManifest(targetDir);
    writeManifest(targetDir, newManifest);
  }

  // Set data for json output
  log.setData("update", {
    updated: stats.updated,
    skipped: stats.skipped,
    added: stats.added,
    userModified: stats.userModified,
  });

  return stats;
}

/** Copy a single file, creating parent dirs. Sets executable for hooks/scripts. */
function copyFile(src: string, dest: string, dryRun: boolean): void {
  if (dryRun) return;

  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);

  // Set executable for hooks and scripts/bin
  const parent = dirname(dest).split("/").pop() ?? "";
  const ext = basename(dest).includes(".") ? "." + basename(dest).split(".").pop() : "";
  if (ext === ".sh" || parent === "hooks" || parent === "bin") {
    chmodSync(dest, 0o755);
  }
}
