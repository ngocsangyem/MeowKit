#!/usr/bin/env node

import minimist from "minimist";
import pc from "picocolors";
import { detectStack } from "./detect-stack.js";
import { promptUser } from "./prompts.js";
import { validate } from "./validate.js";
import { smartUpdate } from "./smart-update.js";
import * as log from "./logger.js";

const USAGE = `
${pc.bold("create-meowkit")} - scaffold a meowkit configuration for your project

${pc.bold("Usage:")}
  npm create meowkit@latest [options]

${pc.bold("Options:")}
  --force       Overwrite existing .claude/ directory
  --dry-run     Preview files that would be created without writing them
  --mode        Set default mode: fast | balanced | strict
  --no-memory   Disable memory/context persistence
  --global      Install as global config (~/.claude/)
  --json        Output structured JSON (for CI/scripting)
  --verbose     Enable debug logging
  --help        Show this help message
`;

async function main(): Promise<void> {
  const argv = minimist(process.argv.slice(2), {
    boolean: ["force", "dry-run", "memory", "global", "help", "json", "verbose"],
    string: ["mode"],
    default: {
      memory: true,
      force: false,
      "dry-run": false,
      global: false,
      help: false,
      json: false,
      verbose: false,
    },
    alias: {
      h: "help",
      f: "force",
      n: "dry-run",
      m: "mode",
      g: "global",
      v: "verbose",
    },
  });

  // Initialize logger before any output
  log.initLogger({
    json: argv.json,
    verbose: argv.verbose,
    command: "create-meowkit",
  });

  if (argv.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const dryRun: boolean = argv["dry-run"];
  const force: boolean = argv.force;
  const enableMemory: boolean = argv.memory;
  const global: boolean = argv.global;
  const modeOverride: string | undefined = argv.mode;

  const targetDir = global
    ? (process.env.HOME ?? "~")
    : process.cwd();

  if (dryRun) {
    log.info(pc.yellow("Dry-run mode enabled. No files will be written.\n"));
  }

  // Step 1: Detect project stack
  log.info("Detecting project stack...");
  const detected = detectStack(targetDir);
  log.debug(`Stack detection result: ${JSON.stringify(detected)}`);

  if (detected.type !== "unknown") {
    log.success(
      `Detected: ${detected.type} (${detected.frameworks.join(", ") || "no frameworks"}) ` +
        `[confidence: ${Math.round(detected.confidence * 100)}%]`
    );
  } else {
    log.warn("Could not auto-detect project type.");
  }

  // Step 2: Interactive prompts (skip in json mode — require all flags)
  const config = await promptUser(detected);

  // Apply CLI overrides
  if (modeOverride) {
    const validModes = ["fast", "balanced", "strict"] as const;
    if (validModes.includes(modeOverride as (typeof validModes)[number])) {
      config.defaultMode = modeOverride as (typeof validModes)[number];
    } else {
      log.warn(`Invalid mode "${modeOverride}". Using "${config.defaultMode}" from prompt.`);
    }
  }

  if (!enableMemory) {
    config.enableMemory = false;
  }

  // Step 3: Generate/merge — always uses smart update
  // If .claude/ doesn't exist: all files are "new", copies everything
  // If .claude/ exists: merges — overwrites unchanged core, skips user-modified files
  // --force: ignores manifest, overwrites everything
  log.info("Generating configuration files...");
  const stats = await smartUpdate(config, targetDir, dryRun, force);

  const fileCount = stats.updated + stats.added;
  log.setData("filesCreated", fileCount);
  log.setData("targetDir", targetDir);
  log.setData("stats", { updated: stats.updated, added: stats.added, skipped: stats.skipped });

  if (stats.userModified.length > 0) {
    log.warn(`Skipped ${stats.userModified.length} user-modified file(s):`);
    for (const f of stats.userModified.slice(0, 10)) {
      log.warn(`  ${f}`);
    }
    if (stats.userModified.length > 10) {
      log.warn(`  ... and ${stats.userModified.length - 10} more`);
    }
  }

  log.success(`Done: ${stats.updated} updated, ${stats.added} new, ${stats.skipped} skipped`);
  log.debug(`Processed ${fileCount} files in ${targetDir}`);

  // Step 5: Validate output (skip for dry-run)
  if (!dryRun) {
    log.info("Validating output...");
    const result = validate(targetDir);
    log.setData("validation", { valid: result.valid, issues: result.issues });

    if (!result.valid) {
      log.warn("Validation found issues:");
      for (const issue of result.issues) {
        log.warn(`  - ${issue}`);
      }
    }
  }

  // Step 6: Summary
  log.success(`${dryRun ? "Would create" : "Created"} ${fileCount} files in ${targetDir}`);

  if (!dryRun && !log.isJson()) {
    console.log(`\n${pc.bold("Scaffolded the full MeowKit system:")}`);
    console.log(`  ${pc.cyan("agents/")}    13 specialist agents (planner, developer, reviewer, ...)`);
    console.log(`  ${pc.cyan("skills/")}    40+ skills (cook, fix, ship, review, qa, ...)`);
    console.log(`  ${pc.cyan("commands/")}  18 slash commands`);
    console.log(`  ${pc.cyan("modes/")}     7 behavioral modes (default, strict, fast, ...)`);
    console.log(`  ${pc.cyan("rules/")}     12 enforcement rules (security, TDD, gates, ...)`);
    console.log(`  ${pc.cyan("hooks/")}     6 lifecycle hooks`);
    console.log(`  ${pc.cyan("scripts/")}   validation & security scripts`);

    console.log(`\n${pc.bold("Next steps:")}`);
    console.log(`  ${pc.dim("1.")} Review ${pc.bold("CLAUDE.md")} for project conventions`);
    console.log(`  ${pc.dim("2.")} Run ${pc.bold("npx meowkit setup")} for guided configuration`);
    console.log(`  ${pc.dim("3.")} Run ${pc.bold("npx meowkit doctor")} to verify your environment`);
  }

  log.flush();
}

main().catch((err: unknown) => {
  log.error(err instanceof Error ? err.message : String(err));
  log.flush();
  process.exit(1);
});
