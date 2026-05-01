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
import { migrate } from "./commands/migrate.js";
import { setup } from "./commands/setup.js";
import { task } from "./commands/task.js";
import { orchviz } from "./commands/orchviz.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgJson = JSON.parse(fs.readFileSync(join(__dirname, "..", "package.json"), "utf-8")) as { version: string };
const VERSION = pkgJson.version;

function printHelp(): void {
	console.log(`
${pc.bold(pc.cyan("mewkit"))} ${pc.dim(`v${VERSION}`)} — MeowKit runtime CLI

${pc.bold("Usage:")}
  mewkit <command> [options]

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
  ${pc.green("migrate")}    Export MeowKit to external coding-agent tools (cursor, codex, ...)
  ${pc.green("orchviz")}    Live web visualizer for the active Claude Code session

${pc.bold("Options:")}
  --help, -h       Show help
  --version, -v    Show version

${pc.bold("Init flags for post-init migration:")}
  --migrate                  After unpack, prompt for providers to export to (interactive)
  --migrate-to <csv|all>     After unpack, export to listed providers (e.g. cursor,codex)
  --migrate-global           Use global install paths (~/.cursor/, etc.) instead of project-local

${pc.bold("orchviz flags:")}
  --port <number>            Bind to fixed port (default: random)
  --open / --no-open         Auto-launch browser (default: --open)
  --session <id>             Pin to a single Claude Code session id
  --workspace <path>         Override watched workspace (default: cwd)
  --verbose                  Print sanitized AgentEvents to stderr
  --log [path]               Persist events to markdown (default: .claude/logs/orchviz-<sid>.md)
`);
}

async function printStatus(): Promise<void> {
	const channel = VERSION.includes("-beta") || VERSION.includes("-rc") ? "beta" : "stable";
	console.log(`${pc.bold(pc.cyan("mewkit"))} ${pc.dim(`v${VERSION}`)} ${pc.dim(`(${channel})`)}`);
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
		boolean: [
			"help",
			"version",
			"check",
			"beta",
			"list",
			"monthly",
			"clear",
			"show",
			"stats",
			"report",
			"all",
			"dry-run",
			"force",
			"system-deps",
			"yes",
			"global",
			"skip-config",
			"skip-rules",
			"skip-hooks",
			"install",
			"reconcile",
			"reinstall-empty-dirs",
			"respect-deletions",
			"prefer-agents-md",
			"migrate",
			"migrate-global",
			"open",
			"no-open",
			"no-color",
			"verbose",
		],
		string: [
			"only",
			"type",
			"priority",
			"status",
			"source",
			"source-version",
			"migrate-to",
			"port",
			"session",
			"workspace",
			"log",
		],
		alias: { h: "help", v: "version", y: "yes" },
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
				migrate: args.migrate as boolean | undefined,
				migrateTo: args["migrate-to"] as string | undefined,
				migrateGlobal: args["migrate-global"] as boolean | undefined,
			});
			break;
		case "upgrade":
			await upgrade({
				check: args.check as boolean | undefined,
				beta: args.beta as boolean | undefined,
				list: args.list as boolean | undefined,
			});
			break;
		case "validate":
			await validate();
			break;
		case "budget":
			await budget({ monthly: args.monthly as boolean | undefined });
			break;
		case "memory":
			await memory({
				clear: args.clear as boolean | undefined,
				show: args.show as boolean | undefined,
				stats: args.stats as boolean | undefined,
			});
			break;
		case "setup":
			await setup({ only: args.only as string | undefined, systemDeps: args["system-deps"] as boolean | undefined });
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
		case "orchviz": {
			const portRaw = args.port as string | number | undefined;
			let port: number | undefined;
			if (portRaw !== undefined) {
				const parsed = typeof portRaw === "number" ? portRaw : parseInt(String(portRaw), 10);
				if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
					console.error(pc.red(`Invalid --port value: ${String(portRaw)} (must be 0-65535; 0 = random)`));
					process.exit(2);
				}
				port = parsed;
			}
			await orchviz({
				port,
				open: args.open as boolean | undefined,
				noOpen: args["no-open"] as boolean | undefined,
				session: args.session as string | undefined,
				workspace: args.workspace as string | undefined,
				noColor: args["no-color"] as boolean | undefined,
				verbose: args.verbose as boolean | undefined,
				log: args.log as string | boolean | undefined,
			});
			break;
		}
		case "migrate": {
			const exitCode = await migrate({
				_: args._.map(String),
				all: args.all as boolean | undefined,
				global: args.global as boolean | undefined,
				yes: args.yes as boolean | undefined,
				"dry-run": args["dry-run"] as boolean | undefined,
				force: args.force as boolean | undefined,
				source: args.source as string | undefined,
				only: args.only as string | undefined,
				"skip-config": args["skip-config"] as boolean | undefined,
				"skip-rules": args["skip-rules"] as boolean | undefined,
				"skip-hooks": args["skip-hooks"] as boolean | undefined,
				install: args.install as boolean | undefined,
				reconcile: args.reconcile as boolean | undefined,
				"reinstall-empty-dirs": args["reinstall-empty-dirs"] as boolean | undefined,
				"respect-deletions": args["respect-deletions"] as boolean | undefined,
				"prefer-agents-md": args["prefer-agents-md"] as boolean | undefined,
				"source-version": args["source-version"] as string | undefined,
			});
			if (exitCode !== 0) process.exit(exitCode);
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
