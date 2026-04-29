// Skill directory installer — recursively copies a skill folder (SKILL.md + references/ + scripts/)
// to the target provider's skill path. Handles colon→dash sanitization for cross-platform safety.

import { existsSync } from "node:fs";
import { cp, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { providers } from "./provider-registry.js";
import { getPortableInstallPath } from "./provider-registry-utils.js";
import { sanitizeSkillName } from "./discovery/skills-discovery.js";
import { computeContentChecksum } from "./reconcile/checksum-utils.js";
import { addPortableInstallation } from "./reconcile/portable-registry.js";
import type { ProviderType, SkillInfo } from "./types.js";

export interface SkillInstallResult {
	skill: string;
	provider: ProviderType;
	success: boolean;
	path?: string;
	error?: string;
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
		return { skill: skill.name, provider, success: false, error: `No ${options.global ? "global" : "project"} skills path for ${provider}` };
	}

	const targetDir = join(targetBase, sanitizedName);

	try {
		const parent = dirname(targetDir);
		if (!existsSync(parent)) await mkdir(parent, { recursive: true });

		await cp(skill.sourcePath, targetDir, { recursive: true, force: true, errorOnExist: false });

		const skillMdPath = join(skill.sourcePath, "SKILL.md");
		const skillMdTarget = join(targetDir, "SKILL.md");
		const sourceChecksum = computeContentChecksum(await readFile(skillMdPath, "utf-8"));
		const targetChecksum = computeContentChecksum(await readFile(skillMdTarget, "utf-8"));

		await addPortableInstallation(
			skill.name, "skill", provider, options.global, targetDir, skill.sourcePath,
			{ sourceChecksum, targetChecksum, installSource: "kit" },
		);

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
