#!/usr/bin/env node

import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import minimist from "minimist";
import pc from "picocolors";
import { init } from "./commands/init.js";
import { upgrade } from "./commands/upgrade.js";
import { validate } from "./commands/validate.js";
import { capabilities } from "./commands/capabilities.js";
import { taskState } from "./commands/task-state.js";
import { budget, contextBudget } from "./commands/budget.js";
import { memory } from "./commands/memory.js";
import { verdictGate } from "./commands/verdict-gate.js";
import { doctor } from "./commands/doctor.js";
import { migrate } from "./commands/migrate.js";
import { setup } from "./commands/setup.js";
import { task } from "./commands/task.js";
import { orchviz } from "./commands/orchviz.js";
import { inventory } from "./commands/inventory.js";
import { trace } from "./commands/trace.js";
// NOTE: index-command is imported lazily inside its case — it pulls in `node:sqlite`
// (experimental), so a static import would load SQLite + emit its warning on EVERY command.
import { pack } from "./commands/pack.js";
import { providersCommand } from "./commands/providers.js";
import { buildPlugin } from "./commands/build-plugin.js";

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
  ${pc.green("validate")}   Validate .claude/ project structure (--mode authoring|flat-copy; auto-detected)
  ${pc.green("capabilities")} Inspect/resolve the capability manifest ('capabilities list|explain <id>|resolve --intent "…"|view|bootstrap|projections' [--json])
  ${pc.green("budget")}     View token usage and cost log ('budget context' for per-profile size)
  ${pc.green("memory")}     Manage agent memory (lessons & patterns)
  ${pc.green("setup")}      Guided post-scaffold configuration
  ${pc.green("doctor")}     Diagnose common environment issues ('doctor provenance --explain' for a read-only provenance report)
  ${pc.green("status")}     Print version and config summary
  ${pc.green("task-state")} Durable task record ('task-state show [--json]' | 'task-state update <id> --status --step --next --plan')
  ${pc.green("task")}       Create and list task files (new, list)
  ${pc.green("migrate")}    Export MeowKit to external coding-agent tools (cursor, codex, ...)
  ${pc.green("providers")}  Show effective provider support matrix and enforcement levels
  ${pc.green("orchviz")}    Live web visualizer for the active Claude Code session
  ${pc.green("inventory")}  List harness artifacts with governance metadata
  ${pc.green("trace")}      On-demand trace recall: score | audit | propose | --friction
  ${pc.green("index")}      Build/refresh the opt-in derived SQLite index over the append logs
  ${pc.green("query")}      Read-only aggregate queries over the derived index
  ${pc.green("pack")}       Manage install packs (list, add, remove)
  ${pc.green("build-plugin")} Generate the native plugin distribution (plugin/ + marketplaces)

${pc.bold("Options:")}
  --help, -h       Show help
  --version, -v    Show version
  --session [id]   Budget: filter to current session or a specific session id
  --day [date]     Budget: filter to today or a specific YYYY-MM-DD
  --providers      Doctor/migrate: include provider contract diagnostics
  --state          Doctor: include state taxonomy diagnostics
  --hard-gates     Doctor: live-probe the hard gates (plan/privacy/injection block)
  --portable       Validate: include portable provider contract checks
  --strict         Validate: treat WARN as failure (exit 1); off by default
  --workflow       Validate: run only the workflow.yaml drift-check (CI scope)
  --ownership      Validate: run only the artifact ownership-completeness check
  --packs          Validate: run only the pack-manifest coherence + safety check
  --rules          Validate: run only the routing-table-breadth WARN check
  --fail-over <N>  Budget context: exit non-zero when a profile exceeds N tokens
  --json           Providers/inventory: emit machine-readable JSON
  --stale          Inventory: show only deprecated/experimental artifacts
  --critical       Inventory: show only criticality=critical artifacts
  --portable-missing  Inventory: show artifacts whose runtime is not portable
  --check          Inventory: fail if README/index counts drift from reality
  --emit-counts    Inventory: rewrite README/index count numbers to match reality
  --substrate      Inventory: print the responsibility×coverage substrate matrix (--emit writes the view)
                   Validate: run only the responsibility-substrate drift/untagged check

${pc.bold("Migrate flags:")}
  --dry-run                  Print the migration plan and reference report without writing
  --only <types>             Limit to item types (agents,commands,skills,config,rules,hooks)
  --force                    Overwrite user-edited targets on conflict
  --all-rules                Merge ALL rules into the provider instruction file (skip portability filter)
  --include-mcp              Also convert .mcp.json servers into the provider MCP config (Codex)

${pc.bold("Init flags:")}
  --profile <name>           Install a subset: core|developer|product|atlassian|security|research|full
                             (default full). In update mode, trims an install down to the profile.

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
			"strict",
			"beta",
			"list",
			"monthly",
			"clear",
			"show",
			"stats",
			"report",
			"providers",
			"state",
			"hard-gates",
			"portable",
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
			"all-rules",
			"include-mcp",
			"no-cleanup",
			"migrate",
			"migrate-global",
			"open",
			"no-open",
			"no-color",
			"verbose",
			"workflow",
			"ownership",
			"json",
			"stale",
			"critical",
			"portable-missing",
			"emit-counts",
			"packs",
			"rules",
			"substrate",
			"capabilities",
			"emit",
			"commit",
			"explain",
			"write",
		],
		string: [
			"mode",
			"intent",
			"provider",
			"step",
			"next",
			"plan",
			"only",
			"type",
			"priority",
			"status",
			"source",
			"source-version",
			"migrate-to",
			"port",
			"session",
			"day",
			"workspace",
			"log",
			"profile",
			"fail-over",
			"friction",
			"id",
			"responsibility",
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
				profile: args.profile as string | undefined,
			});
			break;
		case "upgrade":
			await upgrade({
				check: args.check as boolean | undefined,
				beta: args.beta as boolean | undefined,
				list: args.list as boolean | undefined,
				noCleanup: args["no-cleanup"] as boolean | undefined,
				yes: args.yes as boolean | undefined,
			});
			break;
		case "validate": {
			const modeArg = args.mode as string | undefined;
			if (modeArg !== undefined && modeArg !== "authoring" && modeArg !== "flat-copy") {
				console.error(`Invalid --mode "${modeArg}". Expected "authoring" or "flat-copy".`);
				process.exit(1);
			}
			await validate({
				mode: modeArg as "authoring" | "flat-copy" | undefined,
				portable: args.portable as boolean | undefined,
				strict: args.strict as boolean | undefined,
				workflow: args.workflow as boolean | undefined,
				ownership: args.ownership as boolean | undefined,
				substrate: args.substrate as boolean | undefined,
				packs: args.packs as boolean | undefined,
				rules: args.rules as boolean | undefined,
				plugin: args.plugin as boolean | undefined,
				capabilities: args.capabilities as boolean | undefined,
			});
			break;
		}
		case "build-plugin":
			await buildPlugin({
				json: args.json as boolean | undefined,
			});
			break;
		case "capabilities":
			await capabilities({
				subcommand: args._[1] as string | undefined,
				target: args._[2] as string | undefined,
				json: args.json as boolean | undefined,
				intent: args.intent as string | undefined,
				provider: args.provider as string | undefined,
				write: args.write as boolean | undefined,
			});
			break;
		case "pack":
			await pack({
				subcommand: args._[1] as string | undefined,
				packs: args._.slice(2).map(String),
				json: args.json as boolean | undefined,
				yes: args.yes as boolean | undefined,
				beta: args.beta as boolean | undefined,
			});
			break;
		case "providers":
		case "explain-support":
			await providersCommand({
				provider: args._[1] as string | undefined,
				json: args.json as boolean | undefined,
			});
			break;
		case "inventory":
			await inventory({
				json: args.json as boolean | undefined,
				stale: args.stale as boolean | undefined,
				critical: args.critical as boolean | undefined,
				portableMissing: args["portable-missing"] as boolean | undefined,
				check: args.check as boolean | undefined,
				emitCounts: args["emit-counts"] as boolean | undefined,
				substrate: args.substrate as boolean | undefined,
				emit: args.emit as boolean | undefined,
			});
			break;
		case "trace":
			trace({
				subcommand: args._[1] as string | undefined,
				id: args.id as string | undefined,
				friction: args.friction as string | undefined,
				responsibility: args.responsibility as string | undefined,
				commit: args.commit as boolean | undefined,
				json: args.json as boolean | undefined,
			});
			break;
		case "index": {
			const { indexCommand } = await import("./commands/index-command.js");
			indexCommand({ json: args.json as boolean | undefined });
			break;
		}
		case "query": {
			const { queryCommand } = await import("./commands/index-command.js");
			queryCommand({ json: args.json as boolean | undefined });
			break;
		}
		case "wiki": {
			const { wikiCommand } = await import("./wiki/interface/cli.js");
			await wikiCommand({
				subcommand: args._[1] as string | undefined,
				rest: args._.slice(2).map(String),
				flags: args as Record<string, unknown>,
			});
			break;
		}
		case "budget": {
			// `budget context` routes to the per-profile context estimator (positional,
			// not a flag — minimist parses it as args._[1]).
			if (args._[1] === "context") {
				const failOverRaw = args["fail-over"] as string | number | undefined;
				let failOver: number | undefined;
				if (failOverRaw !== undefined) {
					failOver = Number(failOverRaw);
					if (!Number.isFinite(failOver)) {
						console.error(pc.red(`Invalid --fail-over value: ${String(failOverRaw)} (expected a number)`));
						process.exit(2);
					}
				}
				contextBudget({
					profile: args.profile as string | undefined,
					failOver,
					json: args.json as boolean | undefined,
				});
				break;
			}
			await budget({
				monthly: args.monthly as boolean | undefined,
				session: args.session as boolean | string | undefined,
				day: args.day as boolean | string | undefined,
			});
			break;
		}
		case "memory":
			await memory({
				subcommand: args._[1] as string | undefined,
				clear: args.clear as boolean | undefined,
				stats: args.stats as boolean | undefined,
				strict: args.strict as boolean | undefined,
				check: args.check as boolean | undefined,
			});
			break;
		case "verdict-gate":
			verdictGate({ slug: args._[1] as string | undefined });
			break;
		case "setup":
			await setup({ only: args.only as string | undefined, systemDeps: args["system-deps"] as boolean | undefined });
			break;
		case "doctor":
			await doctor({
				report: args.report as boolean | undefined,
				providers: args.providers as boolean | undefined,
				state: args.state as boolean | undefined,
				hardGates: args["hard-gates"] as boolean | undefined,
				// `doctor provenance [--explain]`: read-only provenance report.
				provenance: args._[1] === "provenance" || undefined,
				explain: args.explain as boolean | undefined,
			});
			break;
		case "status":
			await printStatus();
			break;
		case "task-state":
			await taskState({
				subcommand: args._[1] as string | undefined,
				taskId: args._[2] as string | undefined,
				status: args.status as string | undefined,
				step: args.step as string | undefined,
				next: args.next as string | undefined,
				plan: args.plan as string | undefined,
				json: args.json as boolean | undefined,
				cliVersion: VERSION,
			});
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
				"source-version": args["source-version"] as string | undefined,
				providers: args.providers as boolean | undefined,
				"all-rules": args["all-rules"] as boolean | undefined,
				"include-mcp": args["include-mcp"] as boolean | undefined,
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
