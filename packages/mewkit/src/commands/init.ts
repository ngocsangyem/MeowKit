import fs from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { fetchReleases, downloadRelease, cleanupDownload, smartUpdate, validate } from "../core/index.js";
import type { ReleaseInfo, UserConfig } from "../core/index.js";
import { promptAndInstallSystemDeps } from "./setup.js";
import { getRequirementsSource, formatPackageList } from "../core/skills-dependencies.js";
import { ensureVenv, installPipPackages } from "../core/dependency-installer.js";
import { runMigrate, MewkitMigrateError } from "../migrate/migrate-orchestrator.js";
import type { MigrateOptions } from "../migrate/types.js";

export interface InitArgs {
	dryRun?: boolean;
	force?: boolean;
	beta?: boolean;
	/** When true, run interactive provider multiselect after init unpacks. */
	migrate?: boolean;
	/** CSV of provider names (e.g., "cursor,codex") or "all". When set, migration runs after init. */
	migrateTo?: string;
	/** When true, scope the post-init migration globally (~/.cursor/, etc.) instead of per-project. */
	migrateGlobal?: boolean;
}

/** Detect if this is a fresh install or an update */
function detectMode(targetDir: string): "new" | "update" {
	return fs.existsSync(join(targetDir, ".claude")) ? "update" : "new";
}

/** Build @clack/prompts options from release list (top 4 + manual entry) */
function buildReleaseOptions(releases: ReleaseInfo[], beta: boolean) {
	const latestStable = releases.find((r) => !r.isBeta);
	const pool = beta ? releases : releases.filter((r) => !r.isBeta);
	const options = pool.slice(0, 4).map((r) => ({
		value: r.tag,
		label: `${r.version}${r.isBeta ? pc.yellow(" (beta)") : ""}${r.tag === latestStable?.tag ? pc.green(" (latest)") : ""}`,
		hint: r.publishedAt.split("T")[0],
	}));
	options.push({ value: "__manual__", label: pc.dim("Enter version manually..."), hint: "" });
	return options;
}

/** Cancel-safe wrapper: exits on Ctrl+C */
function cancelCheck(value: unknown): void {
	if (p.isCancel(value)) {
		p.cancel("Installation cancelled.");
		process.exit(0);
	}
}

/** Prompt the user for project description, skill deps, and Gemini key */
async function promptNewInstall(): Promise<UserConfig & { installDeps: boolean }> {
	const description = await p.text({
		message: "Describe your project (optional)",
		placeholder: "Press Enter to skip",
		validate() {
			return undefined;
		},
	});
	cancelCheck(description);

	// Skills dependencies prompt (before Gemini key — more common question first)
	const installDeps = await p.confirm({
		message: "Install Python skill dependencies? (into .claude/skills/.venv)",
		initialValue: false,
	});
	const shouldInstallDeps = p.isCancel(installDeps) ? false : installDeps;

	// --- API Keys ---
	const addGeminiKey = await p.confirm({
		message: "Add Gemini API key? (recommended — analysis, image gen, video gen)",
		initialValue: false,
	});
	cancelCheck(addGeminiKey);

	let geminiApiKey: string | null = null;
	if (addGeminiKey) {
		const keyInput = await p.password({
			message: "Enter your Gemini API key (get one at aistudio.google.com/apikey)",
			validate(value: string) {
				if (!value || value.trim().length === 0) return "API key is required";
				if (value.trim().length < 10) return "Key too short — check aistudio.google.com/apikey";
				return undefined;
			},
		});
		cancelCheck(keyInput);
		geminiApiKey = typeof keyInput === "string" ? keyInput.trim() : null;
	}

	// External provider keys (optional fallback)
	const externalProviderKeys: Record<string, string> = {};

	const EXTERNAL_PROVIDERS = [
		{
			id: "minimax",
			name: "MiniMax",
			description: "TTS (332 voices), music, Hailuo video, image fallback",
			envVar: "MEOWKIT_MINIMAX_API_KEY",
			setupUrl: "platform.minimax.io",
			extraEnvVars: {} as Record<string, string>,
		},
		{
			id: "openrouter",
			name: "OpenRouter",
			description: "Image gen fallback (Flux models)",
			envVar: "MEOWKIT_OPENROUTER_API_KEY",
			setupUrl: "openrouter.ai/keys",
			extraEnvVars: { MEOWKIT_OPENROUTER_FALLBACK_ENABLED: "true" },
		},
	];

	const addFallback = await p.confirm({
		message: "Add fallback API keys for external providers? (optional)",
		initialValue: false,
	});

	if (addFallback && !p.isCancel(addFallback)) {
		const choices = await p.multiselect({
			message: "Select external providers:",
			options: EXTERNAL_PROVIDERS.map((prov) => ({
				value: prov.id,
				label: prov.name,
				hint: prov.description,
			})),
			required: false,
		});

		if (!p.isCancel(choices)) {
			for (const providerId of choices as string[]) {
				const provider = EXTERNAL_PROVIDERS.find((pr) => pr.id === providerId);
				if (!provider) continue;
				const keyInput = await p.password({
					message: `Enter your ${provider.name} API key (get one at ${provider.setupUrl})`,
					validate(value: string) {
						if (!value || value.trim().length === 0) return "API key is required";
						return undefined;
					},
				});
				if (p.isCancel(keyInput)) continue;
				externalProviderKeys[provider.envVar] = String(keyInput).trim();
				for (const [k, v] of Object.entries(provider.extraEnvVars)) {
					externalProviderKeys[k] = v;
				}
			}
		}
	}

	return {
		description: typeof description === "string" ? description.trim() : "",
		enableCostTracking: true,
		enableMemory: true,
		geminiApiKey,
		externalProviderKeys: Object.keys(externalProviderKeys).length > 0 ? externalProviderKeys : undefined,
		installDeps: shouldInstallDeps,
	};
}

/** Print install/update summary */
function printSummary(
	stats: { updated: number; added: number; skipped: number; userModified: string[] },
	dryRun: boolean,
): void {
	console.log(`\n${pc.bold("Summary:")}`);
	if (stats.added > 0) console.log(`  ${pc.green("added")}     ${stats.added}`);
	if (stats.updated > 0) console.log(`  ${pc.cyan("updated")}   ${stats.updated}`);
	if (stats.skipped > 0) console.log(`  ${pc.dim("skipped")}   ${stats.skipped}`);
	if (stats.userModified.length > 0) {
		console.log(pc.yellow(`\n  ${stats.userModified.length} user-modified file(s) preserved:`));
		stats.userModified.slice(0, 8).forEach((f) => console.log(`    ${pc.dim(f)}`));
		if (stats.userModified.length > 8) console.log(`    ${pc.dim(`...and ${stats.userModified.length - 8} more`)}`);
	}
	if (!dryRun) {
		console.log(`\n${pc.bold("Next steps:")}`);
		console.log(`  ${pc.dim("1.")} Run ${pc.bold("npx mewkit setup")} for guided configuration`);
		console.log(`  ${pc.dim("2.")} Run ${pc.bold("npx mewkit doctor")} to verify your environment`);
	}
}

export async function init(args: InitArgs): Promise<void> {
	const targetDir = process.cwd();
	const mode = detectMode(targetDir);
	const dryRun = args.dryRun ?? false;
	const force = args.force ?? false;

	p.intro(pc.bgCyan(pc.black(" meowkit init ")));

	if (dryRun) p.log.warn("Dry-run mode — no files will be written.");
	if (mode === "update") p.log.info("Existing .claude/ detected — running in update mode.");

	// Step 1: Fetch releases
	const releaseSpinner = p.spinner();
	releaseSpinner.start("Fetching available releases...");

	let releases: ReleaseInfo[];
	try {
		releases = await fetchReleases();
	} catch (err: unknown) {
		releaseSpinner.stop("Failed to fetch releases");
		const msg = err instanceof Error ? err.message : String(err);
		p.cancel(`Cannot fetch releases from GitHub: ${msg}`);
		process.exit(1);
	}

	if (releases.length === 0) {
		releaseSpinner.stop("No releases found");
		p.cancel("No releases available on GitHub.");
		process.exit(1);
	}

	releaseSpinner.stop(`Found ${releases.length} release(s)`);

	// Step 2: Version picker
	const options = buildReleaseOptions(releases, args.beta ?? false);
	const latestStable = releases.find((r) => !r.isBeta);

	const selected = await p.select({
		message: "Select MeowKit version to install",
		options,
		initialValue: latestStable?.tag ?? releases[0].tag,
	});

	if (p.isCancel(selected)) {
		p.cancel("Installation cancelled.");
		process.exit(0);
	}

	let selectedTag = selected as string;

	// Handle manual version entry
	if (selectedTag === "__manual__") {
		const manualVersion = await p.text({
			message: "Enter version tag (e.g. v1.4.0)",
			placeholder: "v1.4.0",
			validate(value: string) {
				if (!value || !value.trim()) return "Version is required";
				return undefined;
			},
		});
		cancelCheck(manualVersion);
		selectedTag = (manualVersion as string).trim();
		// Ensure tag has 'v' prefix for consistency
		if (!selectedTag.startsWith("v")) selectedTag = `v${selectedTag}`;
	}

	const release = releases.find((r) => r.tag === selectedTag);
	if (!release) {
		p.cancel(
			`Version ${selectedTag} not found. Available: ${releases
				.slice(0, 5)
				.map((r) => r.tag)
				.join(", ")}`,
		);
		process.exit(1);
	}

	// Step 3: Config prompts (new installs only)
	let config: UserConfig & { installDeps: boolean };
	if (mode === "new") {
		config = await promptNewInstall();
	} else {
		config = { description: "", enableCostTracking: true, enableMemory: true, geminiApiKey: null, installDeps: false };
	}

	// Step 4: Download release
	const downloadSpinner = p.spinner();
	downloadSpinner.start(`Downloading v${release.version}...`);

	let sourceDir: string;
	try {
		sourceDir = await downloadRelease(release);
	} catch (err: unknown) {
		downloadSpinner.stop("Download failed");
		const msg = err instanceof Error ? err.message : String(err);
		p.cancel(`Failed to download release: ${msg}`);
		process.exit(1);
	}

	downloadSpinner.stop(`Downloaded v${release.version}`);

	try {
		// Step 5: Apply via smart update
		const updateSpinner = p.spinner();
		updateSpinner.start("Applying files...");
		const stats = await smartUpdate(config, sourceDir, targetDir, dryRun, force);
		updateSpinner.stop(`Applied: ${stats.added} added, ${stats.updated} updated, ${stats.skipped} skipped`);

		// Security confirmation for API keys
		const hasAnyKey = config.geminiApiKey || config.externalProviderKeys;
		if (hasAnyKey && !dryRun) {
			p.log.success("API keys saved to .claude/.env (local only — never committed to git)");
		}

		// Step 6: Validate (skip dry-run)
		if (!dryRun) {
			const validateSpinner = p.spinner();
			validateSpinner.start("Validating installation...");
			const result = validate(targetDir);
			if (result.valid) {
				validateSpinner.stop("Validation passed");
			} else {
				validateSpinner.stop(`Validation: ${result.issues.length} issue(s) — run \`mewkit validate\` for details`);
			}
		}

		// Step 7: System dependencies (optional, skipped on dry-run)
		// Flat list from registry — no per-skill ownership shown (locked decision #4).
		// Each dep rendered as: [ ] Name (~NMB) — all unchecked by default.
		if (!dryRun) {
			console.log(`\n${pc.bold("? Phase 2: System dependencies")} ${pc.dim("(optional)")}`);
			await promptAndInstallSystemDeps(targetDir);
		}

		// Step 8: Skills dependencies (if user opted in during config)
		if (!dryRun && config.installDeps) {
			console.log(`\n${pc.bold("? Phase 3: Skills dependencies")}`);
			const { packages, source } = getRequirementsSource(targetDir);
			console.log(pc.dim(`\n  Packages (from ${source}):\n`));
			console.log(pc.dim(formatPackageList(packages)));
			console.log();

			try {
				const { created } = ensureVenv(targetDir);
				if (created) console.log(`  ${pc.green("✓")} Python venv created`);

				const results = await installPipPackages(targetDir, packages);
				const failed = results.filter((r) => !r.success);
				if (failed.length === 0) {
					console.log(`\n  ${pc.green("✓")} All ${results.length} packages installed`);
				} else {
					console.log(`\n  ${pc.yellow("!")} ${results.length - failed.length} installed, ${failed.length} failed`);
					console.log(pc.dim(`  Re-run: npx mewkit setup --only=deps`));
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.log(`  ${pc.red("✗")} ${msg}`);
				console.log(pc.dim(`  Install later: npx mewkit setup --only=deps`));
			}
		}

		// Step 9: Summary
		printSummary(stats, dryRun);

		// Step 10: Optional migration to external tools
		if (!dryRun && (args.migrate || args.migrateTo)) {
			await runPostInitMigrate(args, targetDir);
		}

		p.outro(pc.green(mode === "new" ? "MeowKit installed!" : "MeowKit updated!"));
	} finally {
		cleanupDownload(sourceDir);
	}
}

/**
 * Run a migration after init unpacks .claude/. Failure here does NOT roll back the
 * unpack — we surface the error and continue. User can re-run `mewkit migrate` later.
 */
async function runPostInitMigrate(args: InitArgs, projectDir: string): Promise<void> {
	console.log(`\n${pc.bold("? Phase 4: Export to external tools")}`);

	const migrateOptions: MigrateOptions = {
		global: args.migrateGlobal ?? false,
		yes: !!args.migrateTo, // CSV/all → non-interactive; bare --migrate stays interactive
		source: join(projectDir, ".claude"),
	};

	if (args.migrateTo) {
		const trimmed = args.migrateTo.trim();
		if (trimmed === "all") {
			migrateOptions.all = true;
		} else {
			migrateOptions.tools = trimmed.split(",").map((t) => t.trim()).filter(Boolean);
		}
	}

	try {
		const exitCode = await runMigrate(migrateOptions, {
			bundledKitDir: join(projectDir, ".claude"),
			argv: [],
		});
		if (exitCode !== 0) {
			console.log(pc.yellow(`[!] Migration exited with code ${exitCode} — re-run "mewkit migrate" to retry.`));
		}
	} catch (err) {
		if (err instanceof MewkitMigrateError) {
			console.log(pc.red(`[!] Migration failed: ${err.message}`));
			console.log(pc.dim(`    Re-run: mewkit migrate <tool>`));
		} else {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(pc.red(`[!] Migration error: ${msg}`));
		}
	}
}
