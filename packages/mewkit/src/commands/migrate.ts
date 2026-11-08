// `mewkit migrate <tool>` — entry point. Parses options, calls runMigrate, exits with code.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { MewkitMigrateError, runMigrate } from "../migrate/migrate-orchestrator.js";
import { beginMachineOutput, endMachineOutput, jsonEmitted, printMutationJson } from "../core/mutation-report.js";
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
	"source-version"?: string;
	providers?: boolean;
	"all-rules"?: boolean;
	"include-mcp"?: boolean;
	"include-unportable"?: boolean;
	json?: boolean;
}

export async function migrate(args: MigrateCliArgs): Promise<number> {
	const tool = args._[1];

	const options: MigrateOptions = {
		tool,
		json: args.json,
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

	// `--json`: the plan narrates on stderr for the whole run so stdout carries
	// the envelope alone. The run can also end before the plan exists — a refused
	// tool, a cancelled confirm, a throw — so whichever return is reached, exactly
	// one envelope is printed.
	if (args.json === true) beginMachineOutput();
	const finish = (exitCode: number, error?: string): number => {
		if (args.json === true) {
			if (!jsonEmitted()) {
				printMutationJson({
					ok: exitCode === 0,
					command: "migrate",
					dryRun: args["dry-run"] === true,
					planned: [],
					applied: [],
					notes: [],
					...(error === undefined ? {} : { error, fix: "Re-run `mewkit migrate <tool>` once the reason above is resolved." }),
				});
			}
			endMachineOutput();
		}
		return exitCode;
	};

	try {
		return finish(await runMigrate(options, { bundledKitDir, argv: process.argv.slice(2) }));
	} catch (err) {
		if (err instanceof MewkitMigrateError) {
			console.error(pc.red(err.message));
			return finish(err.exitCode, err.message);
		}
		const msg = err instanceof Error ? err.message : String(err);
		console.error(pc.red(`Migrate failed: ${msg}`));
		return finish(1, msg);
	}
}
