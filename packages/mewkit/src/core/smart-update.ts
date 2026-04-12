import {
  existsSync, readFileSync, writeFileSync, mkdirSync,
} from "node:fs";
import { join } from "node:path";
import * as log from "./core-logger.js";
import { processTemplate } from "./substitute-placeholders.js";
import type { UserConfig } from "./substitute-placeholders.js";
import { mergeSettingsFile } from "./merge-settings.js";
import {
  readManifest,
  buildManifest,
  writeManifest,
  hashFile,
  classifyLayer,
} from "./compute-checksums.js";
import { loadIgnorePatterns, walkDir, copyFile } from "./smart-update-utils.js";

export interface UpdateStats {
  updated: number;
  skipped: number;
  added: number;
  userModified: string[];
}

/**
 * Smart update from a downloaded release directory.
 *
 * @param config - User configuration (description, API keys, etc.)
 * @param sourceDir - Path to extracted release (contains .claude/, tasks/, CLAUDE.md)
 * @param targetDir - User's project directory
 * @param dryRun - Preview only, no writes
 * @param force - Overwrite all files, ignore user modifications
 */
export async function smartUpdate(
  config: UserConfig,
  sourceDir: string,
  targetDir: string,
  dryRun: boolean,
  force = false
): Promise<UpdateStats> {
  const oldManifest = force ? null : readManifest(join(targetDir, ".claude"));
  const stats: UpdateStats = { updated: 0, skipped: 0, added: 0, userModified: [] };

  if (!oldManifest && existsSync(join(targetDir, ".claude"))) {
    log.warn("No manifest found — will treat all existing files as unmodified.");
  }

  const oldChecksums = oldManifest?.checksums ?? {};
  const isIgnored = loadIgnorePatterns(targetDir);

  // Source .claude/ from downloaded release
  const claudeSrc = join(sourceDir, ".claude");
  if (!existsSync(claudeSrc)) {
    log.error(`Release .claude/ not found at: ${claudeSrc}`);
    process.exit(1);
  }

  // Walk .claude/ files from release
  const claudeFiles = walkDir(claudeSrc, claudeSrc)
    .map((f) => ({ ...f, relPath: `.claude/${f.relPath}` }));

  for (const { relPath, srcPath } of claudeFiles) {
    const destPath = join(targetDir, relPath);
    const layer = classifyLayer(relPath);

    if (isIgnored(relPath)) {
      log.debug(`Ignored (protected): ${relPath}`);
      stats.skipped++;
      continue;
    }

    // settings.json uses append-only merge
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

    // New file → always add
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
      log.debug(`Skipped (user-modified): ${relPath}`);
      stats.userModified.push(relPath);
      stats.skipped++;
      continue;
    }

    // Safe to overwrite
    copyFile(srcPath, destPath, dryRun);
    stats.updated++;
  }

  // Copy tasks/ from release
  const tasksSrc = join(sourceDir, "tasks");
  if (existsSync(tasksSrc)) {
    const taskFiles = walkDir(tasksSrc, tasksSrc)
      .map((f) => ({ ...f, relPath: `tasks/${f.relPath}` }));

    for (const { relPath, srcPath: tSrc } of taskFiles) {
      const tDest = join(targetDir, relPath);
      if (!existsSync(tDest)) {
        copyFile(tSrc, tDest, dryRun);
        stats.added++;
      }
    }

    if (!dryRun) {
      for (const dir of ["tasks/active", "tasks/completed", "tasks/backlog", "tasks/guidelines"]) {
        mkdirSync(join(targetDir, dir), { recursive: true });
      }
    }
  }

  const claudeDir = join(targetDir, ".claude");

  // CLAUDE.md at project root
  const claudeMdSrc = join(sourceDir, "CLAUDE.md");
  const claudeMdDest = join(targetDir, "CLAUDE.md");
  if (existsSync(claudeMdSrc) && !existsSync(claudeMdDest)) {
    processTemplate(claudeMdSrc, claudeMdDest, config, dryRun);
    stats.added++;
  }

  // meowkit.config.json template (generated, not from release)
  const configDest = join(claudeDir, "meowkit.config.json");
  if (!existsSync(configDest)) {
    if (!dryRun) {
      mkdirSync(claudeDir, { recursive: true });
      const configContent = JSON.stringify(
        {
          $schema: "https://meowkit.dev/schema/config.json",
          version: "1.0.0",
          project: { description: config.description || "" },
          features: { costTracking: config.enableCostTracking, memory: config.enableMemory },
        },
        null,
        2
      );
      writeFileSync(configDest, configContent + "\n", "utf-8");
    }
    stats.added++;
  }

  // Write .env with API keys (single read-modify-write cycle)
  const envPath = join(claudeDir, ".env");
  const hasNewKeys = config.geminiApiKey || config.externalProviderKeys;
  if (hasNewKeys) {
    let envContent = existsSync(envPath)
      ? readFileSync(envPath, "utf-8")
      : "# MeowKit environment variables\n# Never commit this file to git.\n\n";

    if (config.geminiApiKey && !envContent.includes("MEOWKIT_GEMINI_API_KEY=")) {
      envContent += `MEOWKIT_GEMINI_API_KEY=${config.geminiApiKey}\n`;
    }
    // Legacy migration: if GEMINI_API_KEY exists but MEOWKIT_ doesn't, add it
    if (!config.geminiApiKey && envContent.includes("GEMINI_API_KEY=") && !envContent.includes("MEOWKIT_GEMINI_API_KEY=")) {
      const match = envContent.match(/^GEMINI_API_KEY=(.+)$/m);
      if (match?.[1]?.trim()) {
        envContent += `MEOWKIT_GEMINI_API_KEY=${match[1].trim()}\n`;
      }
    }
    if (config.externalProviderKeys) {
      for (const [envVar, value] of Object.entries(config.externalProviderKeys)) {
        if (!envContent.includes(`${envVar}=`)) {
          envContent += `${envVar}=${value}\n`;
        }
      }
    }
    if (!dryRun) {
      writeFileSync(envPath, envContent, "utf-8");
    }
    stats.added++;

    // Ensure .gitignore covers .claude/.env (prevents accidental commits)
    const gitignorePath = join(targetDir, ".gitignore");
    if (!dryRun) {
      let gitignoreContent = existsSync(gitignorePath)
        ? readFileSync(gitignorePath, "utf-8")
        : "";
      if (!gitignoreContent.includes(".claude/.env")) {
        gitignoreContent += "\n# MeowKit secrets\n.claude/.env\n";
        writeFileSync(gitignorePath, gitignoreContent, "utf-8");
      }
    }
  }

  // Ensure memory + logs dirs exist
  if (!dryRun) {
    mkdirSync(join(targetDir, ".claude", "memory"), { recursive: true });
    mkdirSync(join(targetDir, ".claude", "logs"), { recursive: true });
  }

  // Write manifest
  if (!dryRun) {
    const newManifest = buildManifest(claudeDir);
    writeManifest(claudeDir, newManifest);
  }

  log.setData("update", {
    updated: stats.updated,
    skipped: stats.skipped,
    added: stats.added,
    userModified: stats.userModified,
  });

  return stats;
}
