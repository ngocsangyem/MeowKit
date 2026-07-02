// Pure path helpers for the Codex command→skill mapping. Dependency-free so
// both the converter and the reference/path registries can import them without
// creating an import cycle.

/**
 * Skill directory name for a migrated command (e.g. "mk/fix" → "source-command-mk-fix").
 *
 * The encoding is injective over the realistic name alphabet [a-z0-9-/_.]:
 * literal hyphens are doubled BEFORE path separators become single hyphens, so
 * a nested "mk/fix" and a flat "mk-fix" cannot collide (which would otherwise
 * make one command's install silently overwrite the other's).
 */
export function codexCommandSkillDirName(commandName: string): string {
	const slug = commandName
		.replace(/\\/g, "/")
		.toLowerCase()
		.replace(/\.md$/, "")
		.replace(/-/g, "--")
		.replace(/\//g, "-")
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/^-+|-+$/g, "");
	return `source-command-${slug || "unnamed"}`;
}

/** Path of the generated skill file relative to the provider skills root */
export function codexCommandSkillRelativePath(commandName: string): string {
	return `${codexCommandSkillDirName(commandName)}/SKILL.md`;
}
