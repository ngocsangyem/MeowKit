// Skill directory installer — recursively copies a skill folder (SKILL.md + references/ + scripts/)
// to the target provider's skill path. Handles colon→dash sanitization for cross-platform safety.

import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { stripClaudeRefs } from "./converters/index.js";
import {
	combineIntegrityIndexes,
	createReferenceIntegrityIndex,
	type ReferenceIntegrityIndex,
} from "./references/fence-aware-reference-rewriter.js";
import { providers } from "./provider-registry.js";
import { getPortableInstallPath } from "./provider-registry-utils.js";
import { sanitizeSkillName } from "./discovery/skills-discovery.js";
import { computeContentChecksum } from "./reconcile/checksum-utils.js";
import { addPortableInstallation } from "./reconcile/portable-registry.js";
import { resolveInstalledBackRef, type InstalledBackRef } from "../core/install-metadata-backref.js";
import { auditSkillDirectory } from "./skill-directory-audit.js";
import { applyEnvVarRewrites } from "./apply-env-var-rewrites.js";
import { detectStateChanging, languageFor } from "./state-changing-script-detector.js";
import type { MigrationDecisionRecord } from "./validation/migration-record-types.js";
import type { ProviderType, SkillInfo } from "./types.js";

const NON_STATE_CHANGING_REWRITE_EXTENSIONS = new Set([".sh", ".py", ".js", ".cjs", ".mjs", ".ts", ".tsx"]);
const REWRITE_SCANNABLE_EXTENSIONS = new Set([
	...NON_STATE_CHANGING_REWRITE_EXTENSIONS,
	".md",
	".mdx",
	".txt",
	".json",
	".jsonc",
	".yaml",
	".yml",
	".toml",
]);

export interface SkillInstallResult {
	skill: string;
	provider: ProviderType;
	success: boolean;
	path?: string;
	error?: string;
	/** Structured decision records (migrated / failed / partial-with-waivers) for the run report. */
	records?: MigrationDecisionRecord[];
}

async function canonicalize(path: string): Promise<string> {
	try {
		return await realpath(path);
	} catch {
		const parent = dirname(path);
		if (parent === path) return resolve(path);
		try {
			const canonicalParent = await realpath(parent);
			const absPath = resolve(path);
			const absParent = resolve(parent);
			const basename = absPath.slice(absParent.length + 1) || "";
			return join(canonicalParent, basename);
		} catch {
			return resolve(path);
		}
	}
}

async function rewriteMarkdownFilesForProvider(
	rootDir: string,
	provider: ProviderType,
	migratedRefs: ReferenceIntegrityIndex | null | undefined,
	occurrencesByFile: Map<string, import("./references/reference-types.js").ReferenceOccurrence[]>,
	baseDir: string = rootDir,
): Promise<void> {
	const entries = await readdir(rootDir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(rootDir, entry.name);
		if (entry.isDirectory()) {
			await rewriteMarkdownFilesForProvider(fullPath, provider, migratedRefs, occurrencesByFile, baseDir);
			continue;
		}
		if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;

		const original = await readFile(fullPath, "utf-8");
		const stripped = stripClaudeRefs(original, {
			provider,
			targetName: providers[provider].displayName,
			file: entry.name,
			migratedRefs,
		});
		const relPath = fullPath.slice(baseDir.length + 1).replace(/\\/g, "/");
		occurrencesByFile.set(relPath, stripped.occurrences);
		if (stripped.content !== original) {
			await writeFile(fullPath, stripped.content, "utf-8");
		}
	}
}

/**
 * Apply the static env-var rewrite table across the copied tree BEFORE the audit.
 * State-changing scripts are NOT rewritten — a rewrite path must never downgrade a
 * state-changing script (LOCKED policy 4a); it fail-closes in the audit regardless.
 * Only "rewrite"-disposition tokens are substituted; "neutralize" tokens remain for
 * the audit to warn+annotate. Returns one migration record per file that changed.
 */
async function applyEnvVarRewritesForProvider(
	rootDir: string,
	provider: ProviderType,
	skill: SkillInfo,
	baseDir: string = rootDir,
): Promise<MigrationDecisionRecord[]> {
	const records: MigrationDecisionRecord[] = [];
	const entries = await readdir(rootDir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = join(rootDir, entry.name);
		if (entry.isDirectory()) {
			records.push(...(await applyEnvVarRewritesForProvider(fullPath, provider, skill, baseDir)));
			continue;
		}
		if (!entry.isFile()) continue;
		const ext = fullPath.slice(fullPath.lastIndexOf(".")).toLowerCase();
		if (!REWRITE_SCANNABLE_EXTENSIONS.has(ext)) continue;

		const original = await readFile(fullPath, "utf-8");
		// Never rewrite a state-changing script — it stays fail-closed by policy.
		if (NON_STATE_CHANGING_REWRITE_EXTENSIONS.has(ext) && detectStateChanging(original, languageFor(fullPath)).stateChanging)
			continue;

		const { content, applied } = applyEnvVarRewrites(original);
		if (applied.length === 0) continue;
		await writeFile(fullPath, content, "utf-8");
		const relPath = fullPath.slice(baseDir.length + 1).replace(/\\/g, "/");
		for (const a of applied) {
			records.push({
				source: `.claude/skills/${skill.dirName}/${relPath}`,
				type: "skill",
				provider,
				outcome: "partial",
				reason: "runtime-neutralized",
				detail: a.annotation,
				target: relPath,
			});
		}
	}
	return records;
}

/**
 * Install a single skill directory to the target provider.
 * Source dir → target dir using node fs.cp recursive.
 * Updates registry with sourceChecksum (SKILL.md content) for idempotency.
 */
export async function installSkillDirectory(
	skill: SkillInfo,
	provider: ProviderType,
	options: {
		global: boolean;
		installedBackRef?: InstalledBackRef | null;
		migratedRefs?: ReferenceIntegrityIndex | null;
	},
): Promise<SkillInstallResult> {
	const providerConfig = providers[provider];
	if (!providerConfig?.skills) {
		return { skill: skill.name, provider, success: false, error: `${provider} does not support skills` };
	}

	const sanitizedName = sanitizeSkillName(skill.dirName);
	const targetBase = options.global ? providerConfig.skills.globalPath : providerConfig.skills.projectPath;
	if (!targetBase) {
		return {
			skill: skill.name,
			provider,
			success: false,
			error: `No ${options.global ? "global" : "project"} skills path for ${provider}`,
		};
	}

	const targetDir = join(targetBase, sanitizedName);

	// Structured decision records — populated during install (waivers/rewrites) and
	// on audit failure (fail-closed). Surfaced on the result so no outcome is silent.
	const installRecords: MigrationDecisionRecord[] = [];
	let failureRecords: MigrationDecisionRecord[] = [];

	try {
		const parent = dirname(targetDir);
		if (!existsSync(parent)) await mkdir(parent, { recursive: true });

		const canonicalSource = await canonicalize(skill.sourcePath);
		const canonicalTarget = await canonicalize(targetDir);
		if (canonicalSource === canonicalTarget) {
			return { skill: skill.name, provider, success: true, path: targetDir };
		}

		const alreadyExists = existsSync(targetDir);
		const backupDir = alreadyExists ? `${targetDir}.mewkit-backup-${process.pid}-${Date.now()}` : null;
		let copied = false;

		if (backupDir) {
			await rename(targetDir, backupDir);
		}

		try {
			await cp(skill.sourcePath, targetDir, { recursive: true, force: true, errorOnExist: false });
			copied = true;
			// The skill being installed is definitionally part of the migration set,
			// so its own fenced self-references always pass the integrity check.
			const selfIndex = createReferenceIntegrityIndex([`.claude/skills/${skill.dirName}/`]);
			const occurrencesByFile = new Map<string, import("./references/reference-types.js").ReferenceOccurrence[]>();
			await rewriteMarkdownFilesForProvider(
				targetDir,
				provider,
				combineIntegrityIndexes(selfIndex, options.migratedRefs),
				occurrencesByFile,
			);
			// Apply the static env-var rewrite table across the tree (scripts + markdown)
			// BEFORE the audit, so table-known tokens (e.g. $CLAUDE_PROJECT_DIR) are already
			// neutralized to a provider-neutral literal when the audit runs. State-changing
			// scripts are skipped inside the helper and stay fail-closed.
			const rewriteRecords =
				provider === "claude-code" ? [] : await applyEnvVarRewritesForProvider(targetDir, provider, skill);
			installRecords.push(...rewriteRecords);

			const audit = await auditSkillDirectory(targetDir, provider, skill.name, { occurrencesByFile });
			if (audit.errors.length > 0) {
				// Fail-closed: emit a structured failure record (never a silent absence),
				// then throw so the catch block rolls the whole skill dir back.
				failureRecords = audit.errors.map((e) => ({
					source: `.claude/skills/${skill.dirName}/${e.filePath}`,
					type: "skill",
					provider,
					outcome: "failed",
					reason: "audit-rejected",
					detail: e.message,
				}));
				throw new Error(`Skill runtime compatibility audit failed: ${audit.errors.map((e) => e.message).join("; ")}`);
			}
			// Downgraded matches (warn+annotate) become partial-migration records.
			for (const w of audit.waivers) {
				installRecords.push({
					source: `.claude/skills/${skill.dirName}/${w.filePath}`,
					type: "skill",
					provider,
					outcome: "partial",
					reason: "runtime-neutralized",
					detail: `${w.message}: ${w.annotation}`,
					target: w.filePath,
				});
			}

			const skillMdPath = join(skill.sourcePath, "SKILL.md");
			const skillMdTarget = join(targetDir, "SKILL.md");
			const sourceChecksum = computeContentChecksum(await readFile(skillMdPath, "utf-8"));
			const targetChecksum = computeContentChecksum(await readFile(skillMdTarget, "utf-8"));

			const backRef = resolveInstalledBackRef(options.installedBackRef ?? null, skill.sourcePath);
			await addPortableInstallation(skill.name, "skill", provider, options.global, targetDir, skill.sourcePath, {
				sourceChecksum,
				targetChecksum,
				installSource: "kit",
				...backRef,
			});
		} catch (error) {
			try {
				if (copied && existsSync(targetDir)) {
					await rm(targetDir, { recursive: true, force: true });
				}
				if (backupDir && existsSync(backupDir)) {
					await rename(backupDir, targetDir);
				}
			} catch (rollbackError) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(
					`${message}; rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
				);
			}
			throw error;
		}

		if (backupDir && existsSync(backupDir)) {
			await rm(backupDir, { recursive: true, force: true });
		}

		return {
			skill: skill.name,
			provider,
			success: true,
			path: targetDir,
			records: installRecords.length > 0 ? installRecords : undefined,
		};
	} catch (err) {
		return {
			skill: skill.name,
			provider,
			success: false,
			error: err instanceof Error ? err.message : String(err),
			records: failureRecords.length > 0 ? failureRecords : undefined,
		};
	}
}

/**
 * Compute the install path for a skill on a target provider (used by reconciler/dry-run).
 */
export function getSkillInstallPath(
	skill: SkillInfo,
	provider: ProviderType,
	options: { global: boolean },
): string | null {
	const sanitizedName = sanitizeSkillName(skill.dirName);
	return getPortableInstallPath(sanitizedName, provider, "skills", options);
}
