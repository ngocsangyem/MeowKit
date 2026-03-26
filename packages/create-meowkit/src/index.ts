#!/usr/bin/env node

import minimist from "minimist";
import pc from "picocolors";
import { detectStack } from "./detect-stack.js";
import { promptUser } from "./prompts.js";
import { generate } from "./generate.js";
import { validate } from "./validate.js";

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
  --help        Show this help message
`;

async function main(): Promise<void> {
  const argv = minimist(process.argv.slice(2), {
    boolean: ["force", "dry-run", "memory", "global", "help"],
    string: ["mode"],
    default: {
      memory: true,
      force: false,
      "dry-run": false,
      global: false,
      help: false,
    },
    alias: {
      h: "help",
      f: "force",
      n: "dry-run",
      m: "mode",
      g: "global",
    },
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
    ? `${process.env.HOME ?? "~"}/.claude`
    : process.cwd();

  if (dryRun) {
    console.log(pc.yellow("Dry-run mode enabled. No files will be written.\n"));
  }

  // Step 1: Detect project stack
  console.log(pc.cyan("Detecting project stack..."));
  const detected = detectStack(targetDir);

  if (detected.type !== "unknown") {
    console.log(
      pc.green(
        `Detected: ${detected.type} (${detected.frameworks.join(", ") || "no frameworks"}) ` +
          `[confidence: ${Math.round(detected.confidence * 100)}%]`
      )
    );
  } else {
    console.log(pc.yellow("Could not auto-detect project type."));
  }

  // Step 2: Interactive prompts
  const config = await promptUser(detected);

  // Apply CLI overrides
  if (modeOverride) {
    const validModes = ["fast", "balanced", "strict"] as const;
    if (validModes.includes(modeOverride as (typeof validModes)[number])) {
      config.defaultMode = modeOverride as (typeof validModes)[number];
    } else {
      console.warn(
        pc.yellow(`Invalid mode "${modeOverride}". Using "${config.defaultMode}" from prompt.`)
      );
    }
  }

  if (!enableMemory) {
    config.enableMemory = false;
  }

  // Step 3: Check for existing .claude directory
  if (!force && !dryRun) {
    const { existsSync } = await import("node:fs");
    const meowkitDir = global ? targetDir : `${targetDir}/.claude`;
    if (existsSync(meowkitDir)) {
      console.error(
        pc.red(
          `\n${meowkitDir} already exists. Use --force to overwrite.`
        )
      );
      process.exit(1);
    }
  }

  // Step 4: Generate files
  console.log(pc.cyan("\nGenerating configuration files..."));
  const fileCount = await generate(config, targetDir, dryRun);

  // Step 5: Validate output (skip for dry-run)
  if (!dryRun) {
    console.log(pc.cyan("\nValidating output..."));
    const result = validate(targetDir);

    if (!result.valid) {
      console.warn(pc.yellow("\nValidation found issues:"));
      for (const issue of result.issues) {
        console.warn(pc.yellow(`  - ${issue}`));
      }
    }
  }

  // Step 6: Summary
  console.log(
    `\n${pc.green(pc.bold("Done!"))} ${dryRun ? "Would create" : "Created"} ${pc.bold(String(fileCount))} files in ${pc.dim(targetDir)}`
  );

  if (!dryRun) {
    console.log(`\nNext steps:`);
    console.log(`  ${pc.dim("1.")} Review ${pc.bold("CLAUDE.md")} for your project conventions`);
    console.log(`  ${pc.dim("2.")} Customize agent files in ${pc.bold(".claude/agents/")}`);
    console.log(`  ${pc.dim("3.")} Copy ${pc.bold(".mcp.json.example")} → ${pc.bold(".mcp.json")} and configure your MCP servers`);
    console.log(`  ${pc.dim("4.")} Run ${pc.bold("meowkit doctor")} to verify your setup`);
  }
}

main().catch((err: unknown) => {
  console.error(pc.red("Fatal error:"), err instanceof Error ? err.message : String(err));
  process.exit(1);
});
