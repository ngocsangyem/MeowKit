#!/usr/bin/env node

import minimist from "minimist";
import pc from "picocolors";
import { promptUser } from "./prompts.js";
import { validate } from "./validate.js";
import { smartUpdate } from "./smart-update.js";
import { fetchReleases, downloadRelease, cleanupDownload, getLatestStable, getLatestBeta } from "./github-releases.js";
import type { ReleaseInfo } from "./github-releases.js";
import * as log from "./logger.js";
import * as spinner from "./spinner.js";

const VERSION = "0.1.0";

const USAGE = `
${pc.bold("create-meowkit")} ${pc.dim(`v${VERSION}`)} — scaffold MeowKit for your project

${pc.bold("Usage:")}
  npm create meowkit@latest [options]

${pc.bold("Options:")}
  --force       Overwrite all files (ignore user modifications)
  --dry-run     Preview files without writing
  --global      Install as global config (~/.claude/)
  --beta        Use latest beta release
  --json        Structured JSON output (for CI/scripting)
  --verbose     Enable debug logging
  --help        Show this help message
`;

async function main(): Promise<void> {
  const argv = minimist(process.argv.slice(2), {
    boolean: ["force", "dry-run", "global", "help", "json", "verbose", "beta"],
    default: {
      force: false,
      "dry-run": false,
      global: false,
      help: false,
      json: false,
      verbose: false,
      beta: false,
    },
    alias: {
      h: "help",
      f: "force",
      n: "dry-run",
      g: "global",
      v: "verbose",
    },
  });

  log.initLogger({
    json: argv.json,
    verbose: argv.verbose,
    command: "create-meowkit",
  });

  if (argv.json) process.env.MEOWKIT_JSON = "1";

  if (argv.help) {
    console.log(USAGE);
    process.exit(0);
  }

  if (!argv.json) {
    console.log(`\n${pc.bold(pc.cyan("create-meowkit"))} ${pc.dim(`v${VERSION}`)}\n`);
  }

  const dryRun: boolean = argv["dry-run"];
  const force: boolean = argv.force;
  const global: boolean = argv.global;
  const beta: boolean = argv.beta;

  const targetDir = global ? (process.env.HOME ?? "~") : process.cwd();

  if (dryRun) {
    log.info(pc.yellow("Dry-run mode — no files will be written.\n"));
  }

  log.debug(`Target directory: ${targetDir}`);

  // Step 1: Fetch available release from GitHub
  spinner.start("Fetching latest release...");
  let release: ReleaseInfo | null;
  try {
    release = beta ? await getLatestBeta() : await getLatestStable();
  } catch (err: unknown) {
    spinner.fail("Failed to fetch releases");
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot fetch releases from GitHub: ${msg}`);
  }

  if (!release) {
    spinner.fail("No release found");
    throw new Error(beta ? "No beta release available" : "No stable release available");
  }

  spinner.succeed(`Found ${beta ? "beta" : "stable"} release: ${pc.cyan(release.version)}`);

  // Step 2: Interactive prompts
  const config = await promptUser();
  log.debug(`Config: ${JSON.stringify({ ...config, geminiApiKey: config.geminiApiKey ? "***" : null })}`);

  // Step 3: Download release assets
  spinner.start(`Downloading v${release.version}...`);
  let sourceDir: string;
  try {
    sourceDir = await downloadRelease(release);
  } catch (err: unknown) {
    spinner.fail("Download failed");
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to download release: ${msg}`);
  }
  spinner.succeed(`Downloaded v${release.version}`);

  // Step 4: Install with smart update
  try {
    log.info(`Writing to: ${targetDir}`);
    spinner.start("Scaffolding MeowKit system...");
    const stats = await smartUpdate(config, sourceDir, targetDir, dryRun, force);
    const fileCount = stats.updated + stats.added;

    if (fileCount > 0) {
      spinner.succeed(`Scaffolded ${fileCount} files`);
    } else {
      spinner.succeed("Already up to date");
    }

    log.setData("filesCreated", fileCount);
    log.setData("targetDir", targetDir);
    log.setData("version", release.version);
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

    // Step 5: Validate (skip for dry-run)
    if (!dryRun) {
      spinner.start("Validating...");
      const result = validate(targetDir);
      log.setData("validation", { valid: result.valid, issues: result.issues });

      if (result.valid) {
        spinner.succeed("Validation passed");
      } else {
        spinner.fail(`Validation: ${result.issues.length} issue(s)`);
        for (const issue of result.issues) {
          log.warn(`  ${issue}`);
        }
      }
    }

    // Step 6: Summary
    log.success(`Done: ${stats.updated} updated, ${stats.added} new, ${stats.skipped} skipped`);

    if (!dryRun && !log.isJson()) {
      console.log(`\n${pc.bold("Next steps:")}`);
      console.log(`  ${pc.dim("1.")} Review ${pc.bold("CLAUDE.md")} for project conventions`);
      console.log(`  ${pc.dim("2.")} Run ${pc.bold("npx meowkit setup")} for guided configuration`);
      console.log(`  ${pc.dim("3.")} Run ${pc.bold("npx meowkit doctor")} to verify your environment`);
    }
  } finally {
    // Always clean up temp download
    cleanupDownload(sourceDir);
  }

  log.flush();
}

/** Classify common errors into actionable messages */
function classifyError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  const msg = err.message;
  const code = (err as NodeJS.ErrnoException).code;

  if (code === "EACCES" || code === "EPERM") {
    return `Permission denied: ${msg}\n  Fix: Check directory permissions or run with appropriate privileges`;
  }
  if (code === "ENOSPC") {
    return `Disk full: ${msg}\n  Fix: Free up disk space and try again`;
  }
  if (msg.includes("Cannot fetch releases")) {
    return `${msg}\n  Fix: Check your internet connection and try again`;
  }
  if (msg.includes("Failed to download")) {
    return `${msg}\n  Fix: Check your internet connection or try a different version`;
  }

  return msg;
}

main().catch((err: unknown) => {
  spinner.fail("Failed");
  log.error(classifyError(err));
  log.flush();
  process.exit(1);
});
