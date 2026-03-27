import {
  existsSync, readFileSync, writeFileSync, readdirSync, statSync,
  mkdirSync, copyFileSync, chmodSync,
} from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import * as log from "./logger.js";
import { resolveTemplateDir } from "./copy-template-tree.js";
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

/** Parse .meowkitignore once, return a matcher function */
function loadIgnorePatterns(targetDir: string): (relPath: string) => boolean {
  const ignorePath = join(targetDir, ".meowkitignore");
  if (!existsSync(ignorePath)) return () => false;

  const patterns = readFileSync(ignorePath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (patterns.length === 0) return () => false;

  return (relPath: string) => {
    for (const p of patterns) {
      if (relPath === p) return true;
      if (p.endsWith("/") && relPath.startsWith(p)) return true;
      if (relPath.startsWith(p + "/")) return true;
    }
    return false;
  };
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
  const oldManifest = force ? null : readManifest(join(targetDir, ".claude"));
  const stats: UpdateStats = { updated: 0, skipped: 0, added: 0, userModified: [] };

  if (!oldManifest) {
    log.warn("No manifest found. Building fresh manifest from existing files...");
  }

  const oldChecksums = oldManifest?.checksums ?? {};
  const isIgnored = loadIgnorePatterns(targetDir);

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
      if (SKIP.has(entry) || entry.endsWith(".pyc") || entry.endsWith("_INDEX.md") || entry === "SKILLS_ATTRIBUTION.md") continue;
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
    if (isIgnored(relPath)) {
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

  const claudeDir = join(targetDir, ".claude");

  // CLAUDE.md goes at project root (Claude Code reads it from there)
  const claudeMdTemplate = join(templateDir, "claude-md.template");
  const claudeMdDest = join(targetDir, "CLAUDE.md");
  if (existsSync(claudeMdTemplate) && !existsSync(claudeMdDest)) {
    processTemplate(claudeMdTemplate, claudeMdDest, config, dryRun);
    stats.added++;
  }

  const configTemplate = join(templateDir, "meowkit-config.json.template");
  const configDest = join(claudeDir, "meowkit.config.json");
  if (existsSync(configTemplate) && !existsSync(configDest)) {
    processTemplate(configTemplate, configDest, config, dryRun);
    stats.added++;
  }

  // Copy static files into .claude/ — skip if already exist
  const staticFiles = [
    { src: "env.example", dest: "env.example" },
    { src: "mcp.json.example", dest: "mcp.json.example" },
    { src: "gitignore.meowkit", dest: "gitignore.meowkit" },
  ];
  for (const { src, dest } of staticFiles) {
    const srcPath = join(templateDir, src);
    const destPath = join(claudeDir, dest);
    if (existsSync(srcPath) && !existsSync(destPath)) {
      copyFile(srcPath, destPath, dryRun);
      stats.added++;
    }
  }

  // Write .env if Gemini API key provided
  if (config.geminiApiKey && !existsSync(join(claudeDir, ".env"))) {
    if (!dryRun) {
      writeFileSync(
        join(claudeDir, ".env"),
        `# MeowKit environment variables\nGEMINI_API_KEY=${config.geminiApiKey}\n`,
        "utf-8"
      );
    }
    stats.added++;
  }

  // Ensure memory + logs dirs exist
  if (!dryRun) {
    mkdirSync(join(targetDir, ".claude", "memory"), { recursive: true });
    mkdirSync(join(targetDir, ".claude", "logs"), { recursive: true });
  }

  // Write manifest inside .claude/
  if (!dryRun) {
    const newManifest = buildManifest(claudeDir);
    writeManifest(claudeDir, newManifest);
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
