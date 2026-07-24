// `mewkit migrate <tool>` — entry point. Parses options, calls runMigrate, exits with code.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { MewkitMigrateError, runMigrate } from "../migrate/migrate-orchestrator.js";
import type { MigrateOptions } from "../migrate/types.js";
import { resolveProjectRoot } from "../state/meowkit-root-resolver.js";
import { runMemoryPreflight } from "../migrate/memory-preflight/memory-preflight.js";
import { renderPreflightReport } from "../migrate/memory-preflight/memory-preflight-report.js";
import { runMemoryMigrationTransaction } from "../migrate/memory-preflight/memory-migration-transaction.js";

// Legacy `.claude/memory/` → `.meowkit/` migration step, run before provider install.
// Read-only on `--dry-run`; otherwise executes the locked, atomic transaction.
// Silent (returns null) when there is nothing to stage and no conflicts, so projects
// with no legacy memory content — or already migrated — see no noise and existing
// migrate behavior is unchanged. Returns a non-zero exit code only to abort on
// conflicts (never overwritten/merged automatically).
async function runMemoryMigrationStep(dryRun: boolean | undefined): Promise<number | null> {
	const projectRoot = resolveProjectRoot(process.cwd());
	if (!projectRoot) return null;
	const plan = await runMemoryPreflight(projectRoot);
	if (plan.actions.length === 0 && plan.conflicts.length === 0) return null; // nothing to do

	console.log(renderPreflightReport(plan));
	if (dryRun) return null; // dry-run: report only, no transaction
	if (plan.conflicts.length > 0) {
		console.error(pc.red("Memory migration aborted: resolve the conflicts above, then re-run."));
		return 2;
	}
	const result = await runMemoryMigrationTransaction(plan, { projectRoot });
	const fenced = result.fenced.length > 0 ? `, ${result.fenced.length} left live in legacy (source changed)` : "";
	console.log(pc.green(`Memory migrated: ${result.published} published, ${result.quarantined} quarantined${fenced}.`));
	return null;
}

export interface MigrateCliArgs {
	_: string[];
	all?: boolean;
	global?: boolean;
	yes?: boolean;
	"dry-run"?: boolean;
	force?: boolean;
	source?: string;
	only?: string;
	"skip-config"?: boolean;
	"skip-rules"?: boolean;
	"skip-hooks"?: boolean;
	install?: boolean;
	reconcile?: boolean;
	"reinstall-empty-dirs"?: boolean;
	"respect-deletions"?: boolean;
	"source-version"?: string;
	providers?: boolean;
	"all-rules"?: boolean;
	"include-mcp"?: boolean;
	"include-unportable"?: boolean;
}

export async function migrate(args: MigrateCliArgs): Promise<number> {
	const tool = args._[1];

	const options: MigrateOptions = {
		tool,
		all: args.all,
		global: args.global,
		yes: args.yes,
		dryRun: args["dry-run"],
		force: args.force,
		source: args.source,
		only: args.only,
		skipConfig: args["skip-config"],
		skipRules: args["skip-rules"],
		skipHooks: args["skip-hooks"],
		install: args.install,
		reconcile: args.reconcile,
		reinstallEmptyDirs: args["reinstall-empty-dirs"],
		respectDeletions: args["respect-deletions"],
		sourceVersion: args["source-version"],
		providers: args.providers,
		allRules: args["all-rules"],
		includeMcp: args["include-mcp"],
		includeUnportable: args["include-unportable"],
	};

	const __dirname = dirname(fileURLToPath(import.meta.url));
	const bundledKitDir = join(__dirname, "..", "..", ".claude");

	try {
		const memExit = await runMemoryMigrationStep(options.dryRun);
		if (memExit !== null) return memExit;
		return await runMigrate(options, { bundledKitDir, argv: process.argv.slice(2) });
	} catch (err) {
		if (err instanceof MewkitMigrateError) {
			console.error(pc.red(err.message));
			return err.exitCode;
		}
		const msg = err instanceof Error ? err.message : String(err);
		console.error(pc.red(`Migrate failed: ${msg}`));
		return 1;
	}
}
