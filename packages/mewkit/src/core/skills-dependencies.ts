/**
 * pip package names: validation and display.
 *
 * What used to live here — a walk that merged every skill's `requirements.txt`
 * into one install set, plus a built-in list of unpinned packages to fall back
 * on when it found none — is deliberately gone. Both were wrong in the same
 * direction: they decided what to install from something other than the pins of
 * the skill being set up.
 *
 * The merge meant installing one skill's dependencies for every skill, so a
 * conflict between two of them had nowhere to go and a user who wanted one
 * skill paid for all of them. The fallback installed three packages with no
 * version comparators at all, which is the one thing an install path must never
 * do: an unpinned spec resolves to whatever the index serves that day.
 *
 * Reading one skill's own pins is `readSkillRequirements` in `skill-env.ts`.
 */

export interface SkillsDependency {
	/** pip package name, as passed to pip install */
	name: string;
	/** Human-readable description for prompt display */
	description: string;
}

/** Validate pip package name — rejects flags, URLs, shell-breaking chars */
const SAFE_PKG_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*(\[[a-zA-Z0-9,_-]*\])?(==|>=|<=|!=|~=|<|>)?[a-zA-Z0-9.*]*$/;

/** Extract base package name, stripping version specifiers (e.g. "pillow>=10.0" → "pillow") */
export function getBasePackageName(name: string): string {
	return (name.split(/[=<>!~]/)[0] ?? name).toLowerCase();
}

export function validatePackageName(name: string): boolean {
	if (!name || name.startsWith("-") || name.includes("://")) return false;
	return SAFE_PKG_RE.test(getBasePackageName(name));
}

/** Format packages for CLI display */
export function formatPackageList(packages: readonly SkillsDependency[]): string {
	return packages
		.map((p) => {
			const desc = p.description ? ` ${p.description}` : "";
			return `  ${p.name.padEnd(18)}${desc}`;
		})
		.join("\n");
}
