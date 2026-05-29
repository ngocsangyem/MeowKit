import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import * as log from "./core-logger.js";
import { processTemplate } from "./substitute-placeholders.js";
import type { UserConfig } from "./substitute-placeholders.js";
import { mergeSettingsFile } from "./merge-settings.js";
import { readManifest, buildManifest, writeManifest, hashFile, classifyLayer } from "./compute-checksums.js";
import type { Manifest } from "./compute-checksums.js";
import { loadIgnorePatterns, walkDir, copyFile } from "./smart-update-utils.js";
import { findOrphans } from "./find-orphans.js";

export interface UpdateStats {
	updated: number;
	skipped: number;
	added: number;
	userModified: string[];
	orphansDeleted: string[];
	orphansSkipped: string[];
}

export interface SmartUpdateOptions {
	/** Default true. Set false to disable orphan deletion (CLI: `--no-cleanup`). */
	cleanup?: boolean;
	/** Default false. Skip confirmation prompt (CLI: `--yes` / `-y`). */
	assumeYes?: boolean;
	/**
	 * Optional UI callback that owns the orphan-confirmation interaction.
	 * Receives the orphan list and returns true to delete, false to skip.
	 * When provided, smartUpdate skips its own console listing + TTY prompt —
	 * the caller is responsible for displaying the orphans and asking the user.
	 * Used by `mewkit init` to pause its spinner around the prompt; without
	 * this hook, an active spinner overwrites the inline `[y/N]` prompt and
	 * the process hangs on stdin.
	 */
	confirmOrphans?: (orphans: string[]) => Promise<boolean>;
}

/**
 * Smart update from a downloaded release directory.
 *
 * @param config - User configuration (description, API keys, etc.)
 * @param sourceDir - Path to extracted release (contains .claude/, tasks/, CLAUDE.md)
 * @param targetDir - User's project directory
 * @param dryRun - Preview only, no writes
 * @param force - Overwrite all files, ignore user modifications
 */
export async function smartUpdate(
	config: UserConfig,
	sourceDir: string,
	targetDir: string,
	dryRun: boolean,
	force = false,
	options: SmartUpdateOptions = {},
): Promise<UpdateStats> {
	const cleanup = options.cleanup !== false; // default-on
	const assumeYes = options.assumeYes === true;
	const oldManifest = force ? null : readManifest(join(targetDir, ".claude"));
	const stats: UpdateStats = {
		updated: 0,
		skipped: 0,
		added: 0,
		userModified: [],
		orphansDeleted: [],
		orphansSkipped: [],
	};

	if (!oldManifest && existsSync(join(targetDir, ".claude"))) {
		log.warn("No manifest found — will treat all existing files as unmodified.");
	}

	const oldChecksums = oldManifest?.checksums ?? {};
	const isIgnored = loadIgnorePatterns(targetDir);

	// Source .claude/ from downloaded release
	const claudeSrc = join(sourceDir, ".claude");
	if (!existsSync(claudeSrc)) {
		log.error(`Release .claude/ not found at: ${claudeSrc}`);
		process.exit(1);
	}

	// Walk .claude/ files from release
	const claudeFiles = walkDir(claudeSrc, claudeSrc).map((f) => {
		const manifestPath = toManifestPath(f.relPath);
		return { ...f, manifestPath, targetRelPath: `.claude/${manifestPath}` };
	});

	for (const { manifestPath, targetRelPath, srcPath } of claudeFiles) {
		const destPath = join(targetDir, targetRelPath);
		const layer = classifyLayer(manifestPath);

		if (isIgnored(targetRelPath)) {
			log.debug(`Ignored (protected): ${targetRelPath}`);
			stats.skipped++;
			continue;
		}

		// settings.json uses append-only merge
		if (manifestPath === "settings.json") {
			mergeSettingsFile(srcPath, destPath, dryRun);
			stats.updated++;
			continue;
		}

		// User layer: never overwrite
		if (layer === "user") {
			if (existsSync(destPath)) {
				log.debug(`Skipped (user layer): ${targetRelPath}`);
				stats.skipped++;
			} else {
				copyFile(srcPath, destPath, dryRun);
				stats.added++;
			}
			continue;
		}

		// New file → always add
		if (!existsSync(destPath)) {
			copyFile(srcPath, destPath, dryRun);
			log.debug(`Added (new): ${targetRelPath}`);
			stats.added++;
			continue;
		}

		// File exists — check if user modified it
		const currentHash = hashFile(destPath);
		const manifestEntry = oldChecksums[manifestPath];

		if (manifestEntry && currentHash !== manifestEntry.sha256) {
			log.debug(`Skipped (user-modified): ${targetRelPath}`);
			stats.userModified.push(targetRelPath);
			stats.skipped++;
			continue;
		}

		// Safe to overwrite
		copyFile(srcPath, destPath, dryRun);
		stats.updated++;
	}

	// Copy tasks/ from release
	const tasksSrc = join(sourceDir, "tasks");
	if (existsSync(tasksSrc)) {
		const taskFiles = walkDir(tasksSrc, tasksSrc).map((f) => ({ ...f, relPath: `tasks/${f.relPath}` }));

		for (const { relPath, srcPath: tSrc } of taskFiles) {
			const tDest = join(targetDir, relPath);
			if (!existsSync(tDest)) {
				copyFile(tSrc, tDest, dryRun);
				stats.added++;
			}
		}

		if (!dryRun) {
			for (const dir of ["tasks/active", "tasks/backlog", "tasks/guidelines"]) {
				mkdirSync(join(targetDir, dir), { recursive: true });
			}
		}
	}

	const claudeDir = join(targetDir, ".claude");

	// CLAUDE.md at project root
	const claudeMdSrc = join(sourceDir, "CLAUDE.md");
	const claudeMdDest = join(targetDir, "CLAUDE.md");
	if (existsSync(claudeMdSrc) && !existsSync(claudeMdDest)) {
		processTemplate(claudeMdSrc, claudeMdDest, config, dryRun);
		stats.added++;
	}

	// meowkit.config.json template (generated, not from release)
	const configDest = join(claudeDir, "meowkit.config.json");
	if (!existsSync(configDest)) {
		if (!dryRun) {
			mkdirSync(claudeDir, { recursive: true });
			const configContent = JSON.stringify(
				{
					$schema: "https://meowkit.dev/schema/config.json",
					version: "1.0.0",
					project: { description: config.description || "" },
					features: { costTracking: config.enableCostTracking, memory: config.enableMemory },
				},
				null,
				2,
			);
			writeFileSync(configDest, configContent + "\n", "utf-8");
		}
		stats.added++;
	}

	// Write .env with API keys (single read-modify-write cycle)
	const envPath = join(claudeDir, ".env");
	const hasNewKeys = config.geminiApiKey || config.externalProviderKeys;
	if (hasNewKeys) {
		let envContent = existsSync(envPath)
			? readFileSync(envPath, "utf-8")
			: "# MeowKit environment variables\n# Never commit this file to git.\n\n";

		if (config.geminiApiKey && !envContent.includes("MEOWKIT_GEMINI_API_KEY=")) {
			envContent += `MEOWKIT_GEMINI_API_KEY=${config.geminiApiKey}\n`;
		}
		// Legacy migration: if GEMINI_API_KEY exists but MEOWKIT_ doesn't, add it
		if (
			!config.geminiApiKey &&
			envContent.includes("GEMINI_API_KEY=") &&
			!envContent.includes("MEOWKIT_GEMINI_API_KEY=")
		) {
			const match = envContent.match(/^GEMINI_API_KEY=(.+)$/m);
			if (match?.[1]?.trim()) {
				envContent += `MEOWKIT_GEMINI_API_KEY=${match[1].trim()}\n`;
			}
		}
		if (config.externalProviderKeys) {
			for (const [envVar, value] of Object.entries(config.externalProviderKeys)) {
				if (!envContent.includes(`${envVar}=`)) {
					envContent += `${envVar}=${value}\n`;
				}
			}
		}
		if (!dryRun) {
			writeFileSync(envPath, envContent, "utf-8");
		}
		stats.added++;

		// Ensure .gitignore covers .claude/.env (prevents accidental commits)
		const gitignorePath = join(targetDir, ".gitignore");
		if (!dryRun) {
			let gitignoreContent = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf-8") : "";
			if (!gitignoreContent.includes(".claude/.env")) {
				gitignoreContent += "\n# MeowKit secrets\n.claude/.env\n";
				writeFileSync(gitignorePath, gitignoreContent, "utf-8");
			}
		}
	}

	// Ensure memory + logs dirs exist
	if (!dryRun) {
		mkdirSync(join(targetDir, ".claude", "memory"), { recursive: true });
		mkdirSync(join(targetDir, ".claude", "logs"), { recursive: true });
	}

	// Orphan cleanup pass — removes user-disk files no longer in the release
	// manifest. Scoped to kit-owned dirs (rules/, skills/, agents/, hooks/);
	// user-private state (memory/, logs/, .env, secrets/) is never inspected.
	// Default-on; opt out via `--no-cleanup`. Confirmation required unless
	// `--yes` / `--force`.
	//
	// Safety gate: only run when a prior meowkit.manifest.json exists in the
	// user's .claude/. Without it the dir is either fresh (no orphans possible)
	// or owned by another tool (claudekit, etc.) — in the latter case every
	// existing file would be flagged and we'd offer to delete the user's
	// other toolkit. `force` is computed from oldManifest at line 47 and is
	// not a re-read, so we read fresh here.
	const hasPriorMeowkitInstall = readManifest(claudeDir) !== null;
	if (cleanup && hasPriorMeowkitInstall) {
		const releaseManifest = buildReleaseManifest(sourceDir);
		if (!releaseManifest) {
			log.warn(
				"release-manifest.json not found in source release — orphan cleanup skipped. " +
					"Pass --no-cleanup to silence this warning, or report the missing manifest as a release-pipeline bug.",
			);
		} else {
			const orphans = findOrphans({ claudeDir, manifest: releaseManifest });
			if (orphans.length > 0) {
				const useCallback = options.confirmOrphans && !dryRun && !assumeYes && !force;
				if (!useCallback) {
					log.info(`Found ${orphans.length} orphan file(s) — files on disk no longer in release:`);
					for (const o of orphans) log.info(`  - ${o}`);
				}

				let proceed: boolean;
				if (dryRun) proceed = false;
				else if (assumeYes || force) proceed = true;
				else if (options.confirmOrphans) proceed = await options.confirmOrphans(orphans);
				else proceed = await confirmDelete(orphans.length);

				if (!proceed) {
					stats.orphansSkipped.push(...orphans);
					if (dryRun) log.info("Dry-run: orphans listed but not deleted.");
					else log.info("Cleanup skipped by user. Pass `--yes` to auto-confirm.");
				} else {
					for (const orphan of orphans) {
						try {
							unlinkSync(join(claudeDir, orphan));
							stats.orphansDeleted.push(orphan);
						} catch (err) {
							log.warn(`Failed to delete orphan ${orphan}: ${(err as Error).message}`);
							stats.orphansSkipped.push(orphan);
						}
					}
					log.info(`Deleted ${stats.orphansDeleted.length} orphan file(s).`);
				}
			}
		}
	}

	// Write manifest
	if (!dryRun) {
		const newManifest = buildManifest(claudeDir);
		writeManifest(claudeDir, newManifest);
	}

	log.setData("update", {
		updated: stats.updated,
		skipped: stats.skipped,
		added: stats.added,
		userModified: stats.userModified,
		orphansDeleted: stats.orphansDeleted,
		orphansSkipped: stats.orphansSkipped,
	});

	return stats;
}

function toManifestPath(relPath: string): string {
	return relPath.replace(/\\/g, "/").replace(/^\.claude\//, "");
}

/**
 * Build a manifest-shaped object from the release source `.claude/` so we can
 * compare against the user-installed dir without writing anything to disk.
 * The release ships `release-manifest.json` at sourceDir root with `files[]`;
 * we project that onto the same `checksums` shape `findOrphans` expects.
 */
function buildReleaseManifest(sourceDir: string): Manifest | null {
	const manifestPath = join(sourceDir, "release-manifest.json");
	if (!existsSync(manifestPath)) return null;
	try {
		const raw = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
			version?: string;
			generatedAt?: string;
			files?: Array<{ path: string; checksum: string }>;
		};
		const checksums: Manifest["checksums"] = {};
		for (const f of raw.files ?? []) {
			checksums[f.path] = { sha256: f.checksum, layer: "core" };
		}
		return {
			version: raw.version ?? "unknown",
			generatedAt: raw.generatedAt ?? new Date().toISOString(),
			checksums,
		};
	} catch (err) {
		log.warn(`Failed to parse release-manifest.json: ${(err as Error).message}`);
		return null;
	}
}

async function confirmDelete(count: number): Promise<boolean> {
	if (!process.stdin.isTTY) {
		log.info(`Non-TTY environment: skipping cleanup of ${count} orphan(s). Re-run with --yes to confirm.`);
		return false;
	}
	process.stdout.write(`\nDelete ${count} orphan file(s)? [y/N] `);
	const answer = await readLine();
	return /^y(es)?$/i.test(answer.trim());
}

function readLine(): Promise<string> {
	return new Promise((resolve) => {
		const onData = (chunk: Buffer) => {
			process.stdin.removeListener("data", onData);
			process.stdin.pause();
			resolve(chunk.toString());
		};
		process.stdin.resume();
		process.stdin.once("data", onData);
	});
}
