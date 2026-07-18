import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";
import * as log from "./core-logger.js";
import { processTemplate } from "./substitute-placeholders.js";
import type { UserConfig } from "./substitute-placeholders.js";
import { mergeSettingsFile } from "./merge-settings.js";
import { writeManifest, hashFile, classifyLayer } from "./compute-checksums.js";
import type { Manifest } from "./compute-checksums.js";
import { loadIgnorePatterns, walkDir, copyFile } from "./smart-update-utils.js";
import { findOrphans } from "./find-orphans.js";
import { readReleaseMetadata, toOrphanManifest, mapPathToLastModified, mapPathToChecksum } from "./release-metadata.js";
import {
	readInstallMetadata,
	readLegacyManifestMetadata,
	buildInstallMetadata,
	indexByPath,
	CorruptInstallMetadataError,
	type InstallFileEntry,
	type MetadataSource,
	type ReadInstallMetadataResult,
} from "./install-metadata.js";
import { writeInstallMetadata } from "./install-metadata-writer.js";

export interface UpdateStats {
	updated: number;
	skipped: number;
	added: number;
	userModified: string[];
	orphansDeleted: string[];
	orphansSkipped: string[];
	/** Paths from release `deletions[]` removed because they were pristine kit-owned files. */
	deletionsDeleted: string[];
	/** Listed deletions left in place (user-modified, not kit-owned, or declined). */
	deletionsSkipped: string[];
	/** Listed deletions that were already absent on disk. */
	deletionsAlreadyGone: string[];
	/** Listed deletions a dry-run would remove. */
	deletionsPreview: string[];
	/** Pristine kit files removed because they fall outside the installed profile. */
	profileTrimmed: string[];
	/** Out-of-profile files kept (user-modified or declined). */
	profileTrimSkipped: string[];
	/** Out-of-profile pristine files a dry-run would trim. */
	profileTrimPreview: string[];
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
	/**
	 * Profile install allow-set: `.claude/`-relative paths the resolved profile
	 * should write. When present, the source walk skips any file NOT in this set,
	 * and a profile-trim pass removes previously-installed pristine kit files that
	 * fall outside it (the full→core downgrade). Absent ⇒ today's full install.
	 */
	allowedPaths?: Set<string>;
	/** Installed profile name to record in metadata ("full" for whole-tree). */
	profile?: string;
	/** Resolved pack list to record in metadata; omit for full/legacy (sentinel). */
	packs?: string[];
	/**
	 * Opt-in profile-trim: delete previously-installed pristine kit files OUTSIDE
	 * `allowedPaths` (the full→core downgrade). ONLY `init --profile` sets this —
	 * `pack add` and `upgrade` pass a narrow allow-set that filters WRITES but must
	 * never trigger a downgrade delete of everything else.
	 */
	trimToProfile?: boolean;
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
	const targetClaudeDir = join(targetDir, ".claude");

	// Single pre-write read of the installed state. Both the user-edit baseline
	// and the orphan-cleanup guard are derived from THIS value and never re-read
	// after any write, so write ordering cannot affect either decision.
	const prior = force ? { source: "none" as MetadataSource, meta: null } : readPriorInstallState(targetClaudeDir);
	const priorSource = prior.source;
	const priorEntriesByPath = indexByPath(prior.meta?.files ?? []);

	const stats: UpdateStats = {
		updated: 0,
		skipped: 0,
		added: 0,
		userModified: [],
		orphansDeleted: [],
		orphansSkipped: [],
		deletionsDeleted: [],
		deletionsSkipped: [],
		deletionsAlreadyGone: [],
		deletionsPreview: [],
		profileTrimmed: [],
		profileTrimSkipped: [],
		profileTrimPreview: [],
	};

	if (priorSource === "none" && !force && existsSync(targetClaudeDir)) {
		log.warn("No installed metadata found — will treat all existing files as unmodified.");
	}

	let settingsMerged = false;
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

		// Profile filter: a resolved allow-set installs only its files. The set
		// always ⊇ base (safety rules + hooks + settings), so this never filters a
		// safety file. Absent ⇒ full tree (unchanged).
		if (options.allowedPaths && !options.allowedPaths.has(manifestPath)) {
			stats.skipped++;
			continue;
		}

		if (isIgnored(targetRelPath)) {
			log.debug(`Ignored (protected): ${targetRelPath}`);
			stats.skipped++;
			continue;
		}

		// settings.json uses append-only merge
		if (manifestPath === "settings.json") {
			mergeSettingsFile(srcPath, destPath, dryRun);
			settingsMerged = true;
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

		// File exists — check if user modified it. The prior baseline hash comes
		// from the canonical reader (legacy `sha256` is mapped to `checksum`), so
		// this comparison is unchanged in meaning from the legacy manifest path.
		const currentHash = hashFile(destPath);
		const priorEntry = priorEntriesByPath[manifestPath];

		if (priorEntry && currentHash !== priorEntry.checksum) {
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

	// Single release read, reused by the deletions pass and the metadata write.
	const release = readReleaseMetadataSafe(sourceDir);

	// Explicit-deletions pass — runs BEFORE orphan cleanup. A path listed in the
	// release `deletions[]` is removed only when the PRE-WRITE installed metadata
	// marks it kit-owned AND its on-disk hash is still pristine. Ownership comes
	// from priorEntriesByPath (a file slated for deletion is absent from the new
	// release, so it has no fresh entry). On a fresh install this map is empty, so
	// every gate fails and the pass is a no-op. Suppressed entirely by
	// `--no-cleanup`, the same safety switch as orphan cleanup (deletions are
	// intent, orphan cleanup is heuristic — `--no-cleanup` disables both).
	if (cleanup && release && release.deletions.length > 0) {
		const eligible: string[] = [];
		for (const relPath of release.deletions) {
			const dest = join(claudeDir, relPath);
			if (!isWithinDir(claudeDir, dest)) {
				stats.deletionsSkipped.push(relPath);
				continue;
			}
			if (!existsSync(dest)) {
				stats.deletionsAlreadyGone.push(relPath);
				continue;
			}
			const entry = priorEntriesByPath[relPath];
			if (!entry || entry.owner !== "meowkit") {
				stats.deletionsSkipped.push(relPath);
				continue;
			}
			if (hashFile(dest) !== entry.checksum) {
				stats.deletionsSkipped.push(relPath); // user-modified — preserve
				continue;
			}
			eligible.push(relPath);
		}

		if (eligible.length > 0) {
			if (dryRun) {
				stats.deletionsPreview.push(...eligible);
			} else {
				let proceed: boolean;
				if (assumeYes || force) proceed = true;
				else if (options.confirmOrphans) proceed = await options.confirmOrphans(eligible);
				else proceed = await confirmDelete(eligible.length);

				if (!proceed) {
					stats.deletionsSkipped.push(...eligible);
				} else {
					for (const relPath of eligible) {
						try {
							unlinkSync(join(claudeDir, relPath));
							stats.deletionsDeleted.push(relPath);
						} catch (err) {
							log.warn(`Failed to delete ${relPath}: ${(err as Error).message}`);
							stats.deletionsSkipped.push(relPath);
						}
					}
					log.info(`Removed ${stats.deletionsDeleted.length} file(s) marked for deletion by the release.`);
				}
			}
		}
	}

	// Orphan cleanup pass — removes user-disk files no longer in the release
	// manifest. Scoped to kit-owned dirs (rules/, skills/, agents/, hooks/);
	// user-private state (memory/, logs/, .env, secrets/) is never inspected.
	// Default-on; opt out via `--no-cleanup`. Confirmation required unless
	// `--yes` / `--force`.
	//
	// Safety gate: only run when a prior MeowKit install is detected. Without it
	// the dir is either fresh (no orphans possible) or owned by another, unrelated
	// tool — in the latter case every existing file would be flagged and we'd offer
	// to delete the user's other toolkit. The guard value is taken
	// from the SINGLE pre-write read at the top of smartUpdate so a later
	// metadata write cannot flip it. A version-only `metadata.json`
	// (`legacy-metadata`) does NOT count — it can come from the old pipeline on a
	// non-checksum install — so only `new` and `legacy-manifest` enable cleanup.
	const hasPriorMeowkitInstall = priorSource === "new" || priorSource === "legacy-manifest";
	if (cleanup && hasPriorMeowkitInstall) {
		const releaseManifest = release ? toOrphanManifest(release) : null;
		if (!releaseManifest) {
			log.warn(
				"release-manifest.json not found in source release — orphan cleanup skipped. " +
					"Pass --no-cleanup to silence this warning, or report the missing manifest as a release-pipeline bug.",
			);
		} else {
			// Paths declared in `deletions[]` are owned by the deletions pass above —
			// whatever it decided (delete / preserve user-modified) is authoritative.
			// Excluding them here prevents orphan cleanup from re-deleting a file the
			// deletions gate deliberately preserved (e.g. a user-modified listed path).
			const deletionSet = new Set(release?.deletions ?? []);
			const orphans = findOrphans({ claudeDir, manifest: releaseManifest }).filter((o) => !deletionSet.has(o));
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

	// Profile-trim pass — the full→core downgrade. When an allow-set is active and
	// a prior MeowKit install exists, previously-installed pristine kit files
	// OUTSIDE the allow-set are removed; otherwise they linger as zombie skills
	// still auto-loaded by the runtime. User-modified files are preserved + warned.
	// Orphan logic can't catch these — they ARE in the release manifest — so this
	// is the dedicated data-safety pass. Suppressed by `--no-cleanup`, never on full.
	if (cleanup && options.trimToProfile && options.allowedPaths && hasPriorMeowkitInstall) {
		const allow = options.allowedPaths;
		const trimEligible: string[] = [];
		for (const entry of prior.meta?.files ?? []) {
			// Normalize to forward slashes — `allow` (resolver) uses them, but a
			// metadata path from collectFiles carries native separators on Windows.
			const relForward = entry.path.replace(/\\/g, "/");
			if (allow.has(relForward) || entry.layer === "user") continue;
			const dest = join(claudeDir, entry.path);
			if (!isWithinDir(claudeDir, dest) || !existsSync(dest)) continue;
			// pristine kit-owned only — user-modified (owner flips to meowkit-modified
			// or disk hash drifts) is preserved, mirroring the deletions-pass guard.
			if (entry.owner !== "meowkit" || hashFile(dest) !== entry.checksum) {
				stats.profileTrimSkipped.push(entry.path);
				continue;
			}
			trimEligible.push(entry.path);
		}
		if (trimEligible.length > 0) {
			if (dryRun) {
				stats.profileTrimPreview.push(...trimEligible);
			} else {
				let proceed: boolean;
				if (assumeYes || force) proceed = true;
				else if (options.confirmOrphans) proceed = await options.confirmOrphans(trimEligible);
				else proceed = await confirmDelete(trimEligible.length);

				if (!proceed) {
					stats.profileTrimSkipped.push(...trimEligible);
				} else {
					for (const relPath of trimEligible) {
						try {
							unlinkSync(join(claudeDir, relPath));
							stats.profileTrimmed.push(relPath);
						} catch (err) {
							log.warn(`Failed to trim ${relPath}: ${(err as Error).message}`);
							stats.profileTrimSkipped.push(relPath);
						}
					}
					log.info(
						`Trimmed ${stats.profileTrimmed.length} file(s) outside the '${options.profile ?? "selected"}' profile.`,
					);
				}
			}
		}
	}

	// Write installed metadata. `dryRun` writes neither file (matches today).
	if (!dryRun) {
		const meta = buildInstallMetadata(claudeDir, {
			version: release?.version ?? "unknown",
			sourceTimestamps: mapPathToLastModified(release),
			expectedChecksums: mapPathToChecksum(release),
			priorEntriesByPath,
			scope: "local",
			mergedSettings: settingsMerged ? ["settings.json"] : undefined,
			profile: options.profile,
			packs: options.packs,
		});
		// Content has already been mutated on disk. A metadata write failure here is
		// fatal, not a warning: silently leaving new content under stale metadata is
		// exactly the provenance divergence this flow must never produce. The atomic
		// writer leaves the prior metadata.json intact on failure, so re-running the
		// install/upgrade rebuilds correct metadata from disk — the recovery path.
		await writeInstallMetadata(claudeDir, meta);
		// One-release rollback dual-write of the legacy manifest. Only after the
		// canonical write succeeds — if the canonical write fails above we never reach
		// here, so the previous legacy manifest stays on disk for the next run.
		// Derived from the entries just computed, avoiding a second scan+hash of .claude/.
		writeManifest(claudeDir, legacyManifestFromInstallMeta(meta));
	}

	log.setData("update", stats);

	return stats;
}

/**
 * Project canonical install metadata onto the legacy `Manifest` shape for the
 * one-release dual-write, reproducing `buildManifest`'s output without a second
 * directory walk (the hashes are already in `meta.files`).
 */
function legacyManifestFromInstallMeta(meta: { installedAt: string; files: InstallFileEntry[] }): Manifest {
	const checksums: Manifest["checksums"] = {};
	for (const f of meta.files) {
		checksums[f.path] = {
			sha256: f.checksum,
			layer: f.layer,
			owner: f.layer === "user" ? "user" : "meowkit",
			baseChecksum: f.checksum,
			sourceChecksum: f.checksum,
			targetChecksum: f.checksum,
			installedAt: meta.installedAt,
		};
	}
	return { version: "0.2.0", generatedAt: meta.installedAt, checksums };
}

function toManifestPath(relPath: string): string {
	return relPath.replace(/\\/g, "/").replace(/^\.claude\//, "");
}

/** True when `target` resolves to a path strictly inside `dir` (no `..` escape, no symlink-free check needed for an exact listed path). */
function isWithinDir(dir: string, target: string): boolean {
	const rel = relative(dir, target);
	return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Read the prior installed state for the user-edit baseline and orphan guard.
 * If the canonical metadata.json is present but corrupt, fall back to the legacy
 * manifest so user-edit protection still has a baseline, rather than treating
 * every file as unmodified.
 */
function readPriorInstallState(claudeDir: string): ReadInstallMetadataResult {
	try {
		return readInstallMetadata(claudeDir);
	} catch (err) {
		if (err instanceof CorruptInstallMetadataError) {
			log.warn(`Installed metadata is corrupt (${err.detail}); falling back to legacy manifest detection.`);
			const legacy = readLegacyManifestMetadata(claudeDir);
			return legacy ? { source: "legacy-manifest", meta: legacy } : { source: "none", meta: null };
		}
		throw err;
	}
}

/** Parse the release manifest, treating a corrupt one as absent (version becomes "unknown"). */
function readReleaseMetadataSafe(sourceDir: string): ReturnType<typeof readReleaseMetadata> {
	try {
		return readReleaseMetadata(sourceDir);
	} catch (err) {
		log.warn(`Failed to read release-manifest.json for installed metadata: ${(err as Error).message}`);
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
