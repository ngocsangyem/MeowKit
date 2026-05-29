// Skill directory installer — recursively copies a skill folder (SKILL.md + references/ + scripts/)
// to the target provider's skill path. Handles colon→dash sanitization for cross-platform safety.

import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { stripClaudeRefs } from "./converters/index.js";
import { providers } from "./provider-registry.js";
import { getPortableInstallPath } from "./provider-registry-utils.js";
import { sanitizeSkillName } from "./discovery/skills-discovery.js";
import { computeContentChecksum } from "./reconcile/checksum-utils.js";
import { addPortableInstallation } from "./reconcile/portable-registry.js";
import { auditSkillDirectory } from "./skill-directory-audit.js";
import type { ProviderType, SkillInfo } from "./types.js";

export interface SkillInstallResult {
	skill: string;
	provider: ProviderType;
	success: boolean;
	path?: string;
	error?: string;
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

async function rewriteMarkdownFilesForProvider(rootDir: string, provider: ProviderType): Promise<void> {
	const entries = await readdir(rootDir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(rootDir, entry.name);
		if (entry.isDirectory()) {
			await rewriteMarkdownFilesForProvider(fullPath, provider);
			continue;
		}
		if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;

		const original = await readFile(fullPath, "utf-8");
		const rewritten = stripClaudeRefs(original, {
			provider,
			targetName: providers[provider].displayName,
		}).content;
		if (rewritten !== original) {
			await writeFile(fullPath, rewritten, "utf-8");
		}
	}
}

/**
 * Install a single skill directory to the target provider.
 * Source dir → target dir using node fs.cp recursive.
 * Updates registry with sourceChecksum (SKILL.md content) for idempotency.
 */
export async function installSkillDirectory(
	skill: SkillInfo,
	provider: ProviderType,
	options: { global: boolean },
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
			await rewriteMarkdownFilesForProvider(targetDir, provider);
			const audit = await auditSkillDirectory(targetDir, provider, skill.name);
			if (audit.errors.length > 0) {
				throw new Error(`Skill runtime compatibility audit failed: ${audit.errors.map((e) => e.message).join("; ")}`);
			}

			const skillMdPath = join(skill.sourcePath, "SKILL.md");
			const skillMdTarget = join(targetDir, "SKILL.md");
			const sourceChecksum = computeContentChecksum(await readFile(skillMdPath, "utf-8"));
			const targetChecksum = computeContentChecksum(await readFile(skillMdTarget, "utf-8"));

			await addPortableInstallation(skill.name, "skill", provider, options.global, targetDir, skill.sourcePath, {
				sourceChecksum,
				targetChecksum,
				installSource: "kit",
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

		return { skill: skill.name, provider, success: true, path: targetDir };
	} catch (err) {
		return {
			skill: skill.name,
			provider,
			success: false,
			error: err instanceof Error ? err.message : String(err),
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
