// `mewkit migrate <tool>` — entry point. Parses options, calls runMigrate, exits with code.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { MewkitMigrateError, runMigrate } from "../migrate/migrate-orchestrator.js";
import type { MigrateOptions } from "../migrate/types.js";

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
	"prefer-agents-md"?: boolean;
	"source-version"?: string;
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
		preferAgentsMd: args["prefer-agents-md"],
		sourceVersion: args["source-version"],
	};

	const __dirname = dirname(fileURLToPath(import.meta.url));
	const bundledKitDir = join(__dirname, "..", "..", ".claude");

	try {
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
