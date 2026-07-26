#!/usr/bin/env node

import fs from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import minimist from "minimist";
import { renderHelp } from "./cli/render-help.js";
import { minimistOptions } from "./cli/minimist-options.js";
import pc from "picocolors";
import { init } from "./commands/init.js";
import { upgrade } from "./commands/upgrade.js";
import { validate } from "./commands/validate.js";
import { capabilities } from "./commands/capabilities.js";
import { taskState } from "./commands/task-state.js";
import { context } from "./commands/context.js";
import { budget, contextBudget } from "./commands/budget.js";
import { memory } from "./commands/memory.js";
import { verdictGate } from "./commands/verdict-gate.js";
import { doctor } from "./commands/doctor.js";
import { migrate } from "./commands/migrate.js";
import { setup } from "./commands/setup.js";
import { task } from "./commands/task.js";
import { inventory } from "./commands/inventory.js";
import { plan } from "./commands/plan.js";
import { planApprove } from "./commands/plan-approve.js";
import { planArchive } from "./commands/plan-archive.js";
import { trace } from "./commands/trace.js";
// NOTE: index-command is imported lazily inside its case — it pulls in `node:sqlite`
// (experimental), so a static import would load SQLite + emit its warning on EVERY command.
import { pack } from "./commands/pack.js";
import { providersCommand } from "./commands/providers.js";
import { visualPlan } from "./commands/visual-plan.js";
import { reviewPrepare } from "./commands/review/prepare.js";
import { reviewRead } from "./commands/review/read.js";
import { reviewCoverage } from "./commands/review/coverage.js";
import { reviewCompose } from "./commands/review/compose.js";
import { reviewSubmit } from "./commands/review/submit.js";
import { reviewCleanup } from "./commands/review/cleanup.js";
import { resolveConfigPath } from "./state/resolve-config-path.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgJson = JSON.parse(fs.readFileSync(join(__dirname, "..", "package.json"), "utf-8")) as { version: string };
const VERSION = pkgJson.version;

function printHelp(): void {
	console.log(renderHelp(VERSION));
}

async function printStatus(): Promise<void> {
	const channel = VERSION.includes("-beta") || VERSION.includes("-rc") ? "beta" : "stable";
	console.log(`${pc.bold(pc.cyan("mewkit"))} ${pc.dim(`v${VERSION}`)} ${pc.dim(`(${channel})`)}`);
	console.log();

	const configPath = resolveConfigPath(process.cwd());
	try {
		const content = fs.readFileSync(configPath, "utf-8");
		const config: Record<string, unknown> = JSON.parse(content) as Record<string, unknown>;
		console.log(`${pc.bold("Config:")} ${relative(process.cwd(), configPath) || configPath}`);
		for (const [key, value] of Object.entries(config)) {
			console.log(`  ${pc.dim(key)}: ${String(value)}`);
		}
	} catch {
		console.log(`${pc.dim("No .meowkit/config.json found.")}`);
	}
}

async function main(): Promise<void> {
	const args = minimist(process.argv.slice(2), minimistOptions());

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
				target: args.target as string | undefined,
				migrateGlobal: args["migrate-global"] as boolean | undefined,
				profile: args.profile as string | undefined,
				skillPacks: args["skill-packs"] as string | undefined,
				mcpProfiles: args["mcp-profiles"] as string | undefined,
				allowCloudMcp: args["allow-cloud-mcp"] as boolean | undefined,
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
				// `validate --target codex <dir>`: the target provider (string) + the dir positional.
				target: args.target as string | undefined,
				targetDir: args._[1] as string | undefined,
				portable: args.portable as boolean | undefined,
				strict: args.strict as boolean | undefined,
				workflow: args.workflow as boolean | undefined,
				gates: args.gates as boolean | undefined,
				ownership: args.ownership as boolean | undefined,
				agents: args.agents as boolean | undefined,
				substrate: args.substrate as boolean | undefined,
				packs: args.packs as boolean | undefined,
				rules: args.rules as boolean | undefined,
				capabilities: args.capabilities as boolean | undefined,
			});
			break;
		}
		case "review": {
			const sub = args._[1] as string | undefined;
			if (sub === "prepare") {
				await reviewPrepare({
					target: args._[2] as string,
					remote: args.remote as string | undefined,
					json: args.json as boolean | undefined,
				});
			} else if (sub === "read") {
				await reviewRead({
					session: args.session as string,
					as: args.as as string,
					target: args._[2] as string,
				});
			} else if (sub === "coverage") {
				await reviewCoverage({
					session: args.session as string,
					json: args.json as boolean | undefined,
				});
			} else if (sub === "compose") {
				await reviewCompose({
					session: args.session as string,
					json: args.json as boolean | undefined,
				});
			} else if (sub === "submit") {
				await reviewSubmit({
					session: args.session as string,
					reply: args.reply as boolean | undefined,
					confirm: args.confirm as string | undefined,
					json: args.json as boolean | undefined,
				});
			} else if (sub === "cleanup") {
				await reviewCleanup({
					session: args.session as string,
					json: args.json as boolean | undefined,
				});
			} else {
				console.error(
					`Unknown review subcommand "${sub ?? ""}". Available: prepare, read, coverage, compose, submit, cleanup`,
				);
				process.exit(1);
			}
			break;
		}
		case "capabilities":
			await capabilities({
				subcommand: args._[1] as string | undefined,
				target: args._[2] as string | undefined,
				json: args.json as boolean | undefined,
				intent: args.intent as string | undefined,
				provider: args.provider as string | undefined,
				write: args.write as boolean | undefined,
				record: args.record as boolean | undefined,
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
				lifecycle: args.lifecycle as boolean | undefined,
			});
			break;
		case "plan": {
			// `approve` and `archive` MUTATE — route them to their own modules so the
			// read-only `plan` command (status/check) stays write-free by construction.
			const planSub = args._[1] as string | undefined;
			if (planSub === "approve") {
				await planApprove({
					target: args._[2] as string | undefined,
					by: args.by as string | undefined,
					// minimist maps `--no-activate` to `activate === false` (negation convention).
					noActivate: args.activate === false,
					cliVersion: VERSION,
				});
			} else if (planSub === "archive") {
				await planArchive({
					target: args._[2] as string | undefined,
					dryRun: args["dry-run"] as boolean | undefined,
				});
			} else {
				await plan({
					subcommand: planSub,
					target: args._[2] as string | undefined,
					json: args.json as boolean | undefined,
				});
			}
			break;
		}
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
			queryCommand({
				json: args.json as boolean | undefined,
				task: args.task as string | undefined,
				presets: args.presets as boolean | undefined,
			});
			break;
		}
		case "orient": {
			const { orient } = await import("./commands/orient.js");
			// minimist maps `--no-record` to `record === false`.
			orient({ json: args.json as boolean | undefined, noRecord: args.record === false });
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
				promptArgs: args._.slice(2).map(String),
			});
			break;
		case "docs-manifest": {
			const { docsManifest } = await import("./commands/docs-manifest.js");
			docsManifest({
				check: args.check as boolean | undefined,
				write: args.write as boolean | undefined,
				json: args.json as boolean | undefined,
			});
			break;
		}
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
				consolidation: args.consolidation as boolean | undefined,
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
				blocker: args.blocker as string | string[] | undefined,
				verification: args.verification as string | string[] | undefined,
				evidenceRef: args["evidence-ref"] as string | string[] | undefined,
				capabilityDecision: args["capability-decision"] as string | string[] | undefined,
				json: args.json as boolean | undefined,
				cliVersion: VERSION,
			});
			break;
		case "context":
			await context({
				subcommand: args._[1] as string | undefined,
				target: args._[2] as string | undefined,
				root: args.root as string | undefined,
				task: args.task as string | undefined,
				json: args.json as boolean | undefined,
			});
			break;
		case "task": {
			const subcommand = args._[1] as string | undefined;
			// positional description: everything after the subcommand that isn't a flag
			const description = args._.slice(2).join(" ");
			await task({
				subcommand,
				type: args.type as string | undefined,
				priority: args.priority as string | undefined,
				all: args.all as boolean | undefined,
				status: args.status as string | undefined,
				description: description || undefined,
				activate: args.activate === true,
				cliVersion: VERSION,
			});
			break;
		}
		case "visual-plan": {
			const vpPortRaw = args.port as string | number | undefined;
			let vpPort: number | undefined;
			if (vpPortRaw !== undefined) {
				const parsed = typeof vpPortRaw === "number" ? vpPortRaw : parseInt(String(vpPortRaw), 10);
				if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
					console.error(pc.red(`Invalid --port value: ${String(vpPortRaw)} (must be 0-65535; 0 = random)`));
					process.exit(2);
				}
				vpPort = parsed;
			}
			await visualPlan({
				subcommand: args._[1] as string | undefined,
				planDir: args._[2] as string | undefined,
				revision: args.revision as string | undefined,
				json: args.json as boolean | undefined,
				open: args.open as boolean | undefined,
				noOpen: args["no-open"] as boolean | undefined,
				force: args.force as boolean | undefined,
				port: vpPort,
				format: args.format as string | undefined,
				ops: args.ops as string | undefined,
				batch: args.batch as string | undefined,
				check: args.check as boolean | undefined,
				receipt: args.receipt as string | undefined,
				op: args.op as string | undefined,
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
				"include-unportable": args["include-unportable"] as boolean | undefined,
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
