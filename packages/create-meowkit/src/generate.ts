import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import type { UserConfig } from "./prompts.js";
import { copyDirRecursive, resolveTemplateDir } from "./copy-template-tree.js";
import { processTemplate } from "./substitute-placeholders.js";

/**
 * Generates the full MeowKit system by copying templates and substituting placeholders.
 *
 * Architecture:
 *   1. Copy templates/claude/ → targetDir/.claude/ (the real MeowKit system)
 *   2. Process .template files with __MEOWKIT_*__ placeholder substitution
 *   3. Write static root files (.env.example, .mcp.json.example, .gitignore additions)
 *   4. Optionally write .env if user provided a Gemini API key
 *   5. Create empty dirs (memory/, logs/) if features enabled
 */
export async function generate(
  config: UserConfig,
  targetDir: string,
  dryRun: boolean
): Promise<number> {
  const templateDir = resolveTemplateDir();

  if (!existsSync(templateDir)) {
    console.error(
      pc.red(
        `Templates directory not found at ${templateDir}.\n` +
          `Run 'npm run build:templates' first, or reinstall the package.`
      )
    );
    process.exit(1);
  }

  let fileCount = 0;

  // Step 1: Copy the full .claude/ system from templates
  const claudeSrc = join(templateDir, "claude");
  const claudeDest = join(targetDir, ".claude");

  if (existsSync(claudeSrc)) {
    fileCount += copyDirRecursive(claudeSrc, claudeDest, dryRun);
  } else {
    console.error(pc.red(`Template .claude/ directory not found at ${claudeSrc}`));
    process.exit(1);
  }

  // Step 2: Process template files with placeholder substitution
  const claudeMdTemplate = join(templateDir, "claude-md.template");
  if (!existsSync(claudeMdTemplate)) {
    console.error(pc.red(`CLAUDE.md template not found at ${claudeMdTemplate}`));
    process.exit(1);
  }
  processTemplate(claudeMdTemplate, join(targetDir, "CLAUDE.md"), config, dryRun);
  fileCount++;

  const configTemplate = join(templateDir, "meowkit-config.json.template");
  if (existsSync(configTemplate)) {
    processTemplate(
      configTemplate,
      join(targetDir, ".meowkit.config.json"),
      config,
      dryRun
    );
    fileCount++;
  }

  // Step 3: Copy static root files
  const staticFiles: Array<{ src: string; dest: string }> = [
    { src: "env.example", dest: ".env.example" },
    { src: "mcp.json.example", dest: ".mcp.json.example" },
    { src: "gitignore.meowkit", dest: ".gitignore.meowkit" },
  ];

  for (const { src, dest } of staticFiles) {
    const srcPath = join(templateDir, src);
    const destPath = join(targetDir, dest);

    if (existsSync(srcPath)) {
      if (dryRun) {
        console.log(`  ${pc.dim("create")} ${destPath}`);
      } else {
        mkdirSync(targetDir, { recursive: true });
        copyFileSync(srcPath, destPath);
      }
      fileCount++;
    }
  }

  // Step 4: Write .env if user provided Gemini API key
  if (config.geminiApiKey) {
    const envPath = join(targetDir, ".env");
    if (dryRun) {
      console.log(`  ${pc.dim("create")} ${envPath}`);
    } else {
      writeFileSync(
        envPath,
        `# MeowKit environment variables\n# WARNING: Never commit this file to git\n\nGEMINI_API_KEY=${config.geminiApiKey}\n`,
        "utf-8"
      );
    }
    fileCount++;
  }

  // Step 5: Ensure empty directories exist
  const emptyDirs: string[] = [];

  if (config.enableMemory) {
    emptyDirs.push(join(claudeDest, "memory"));
  }
  if (config.enableCostTracking) {
    emptyDirs.push(join(claudeDest, "logs"));
  }

  for (const dir of emptyDirs) {
    if (!dryRun) {
      mkdirSync(dir, { recursive: true });
      const gitkeep = join(dir, ".gitkeep");
      if (!existsSync(gitkeep)) {
        writeFileSync(gitkeep, "", "utf-8");
      }
    }
  }

  if (!dryRun) {
    console.log(pc.green(`  Created ${fileCount} files`));
  }

  return fileCount;
}
