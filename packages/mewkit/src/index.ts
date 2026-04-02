#!/usr/bin/env node

import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import minimist from "minimist";
import pc from "picocolors";
import { init } from "./commands/init.js";
import { upgrade } from "./commands/upgrade.js";
import { validate } from "./commands/validate.js";
import { budget } from "./commands/budget.js";
import { memory } from "./commands/memory.js";
import { doctor } from "./commands/doctor.js";
import { setup } from "./commands/setup.js";
import { task } from "./commands/task.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgJson = JSON.parse(fs.readFileSync(join(__dirname, "..", "package.json"), "utf-8")) as { version: string };
const VERSION = pkgJson.version;

function printHelp(): void {
  console.log(`
${pc.bold(pc.cyan("meowkit"))} ${pc.dim(`v${VERSION}`)} — MeowKit runtime CLI

${pc.bold("Usage:")}
  meowkit <command> [options]

${pc.bold("Commands:")}
  ${pc.green("init")}       Scaffold or update MeowKit in the current project
  ${pc.green("upgrade")}    Upgrade MeowKit to the latest version
  ${pc.green("validate")}   Validate .claude/ project structure
  ${pc.green("budget")}     View token usage and cost log
  ${pc.green("memory")}     Manage agent memory (lessons & patterns)
  ${pc.green("setup")}      Guided post-scaffold configuration
  ${pc.green("doctor")}     Diagnose common environment issues
  ${pc.green("status")}     Print version and config summary
  ${pc.green("task")}       Create and list task files (new, list)

${pc.bold("Options:")}
  --help, -h       Show help
  --version, -v    Show version
`);
}

async function printStatus(): Promise<void> {
  const channel = VERSION.includes("-beta") || VERSION.includes("-rc") ? "beta" : "stable";
  console.log(`${pc.bold(pc.cyan("meowkit"))} ${pc.dim(`v${VERSION}`)} ${pc.dim(`(${channel})`)}`);
  console.log();

  const configPath = ".claude/meowkit.config.json";
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const config: Record<string, unknown> = JSON.parse(content) as Record<string, unknown>;
    console.log(`${pc.bold("Config:")} ${configPath}`);
    for (const [key, value] of Object.entries(config)) {
      console.log(`  ${pc.dim(key)}: ${String(value)}`);
    }
  } catch {
    console.log(`${pc.dim("No .claude/meowkit.config.json found.")}`);
  }
}

async function main(): Promise<void> {
  const args = minimist(process.argv.slice(2), {
    boolean: ["help", "version", "check", "beta", "list", "monthly", "clear", "show", "stats", "report", "all", "dry-run", "force"],
    string: ["only", "type", "priority", "status"],
    alias: { h: "help", v: "version" },
  });

  if (args.version) {
    console.log(VERSION);
    return;
  }

  const command = args._[0] as string | undefined;

  if (args.help && !command) {
    printHelp();
    return;
  }

  switch (command) {
    case "init":
      await init({
        dryRun: args["dry-run"] as boolean | undefined,
        force: args.force as boolean | undefined,
        beta: args.beta as boolean | undefined,
      });
      break;
    case "upgrade":
      await upgrade({ check: args.check as boolean | undefined, beta: args.beta as boolean | undefined, list: args.list as boolean | undefined });
      break;
    case "validate":
      await validate();
      break;
    case "budget":
      await budget({ monthly: args.monthly as boolean | undefined });
      break;
    case "memory":
      await memory({ clear: args.clear as boolean | undefined, show: args.show as boolean | undefined, stats: args.stats as boolean | undefined });
      break;
    case "setup":
      setup({ only: args.only as string | undefined });
      break;
    case "doctor":
      await doctor({ report: args.report as boolean | undefined });
      break;
    case "status":
      await printStatus();
      break;
    case "task": {
      const subcommand = args._[1] as string | undefined;
      // positional description: everything after the subcommand that isn't a flag
      const description = args._.slice(2).join(" ");
      task({
        subcommand,
        type: args.type as string | undefined,
        priority: args.priority as string | undefined,
        all: args.all as boolean | undefined,
        status: args.status as string | undefined,
        description: description || undefined,
      });
      break;
    }
    default:
      if (command) {
        console.error(pc.red(`Unknown command: ${command}`));
        console.log();
      }
      printHelp();
      break;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(pc.red(`Fatal: ${message}`));
  process.exit(1);
});
