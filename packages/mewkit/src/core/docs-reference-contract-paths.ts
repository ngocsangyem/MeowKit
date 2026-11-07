import path from "node:path";

/**
 * Repo-root-relative location of the docs-reference contract. It is a maintainer-only
 * document that is NOT shipped into user projects, so it is resolved from the parent of
 * `.claude/` and its absence makes the check N/A rather than a failure.
 */
export const CONTRACT_REL_PATH = path.join("docs", "maintainer", "docs-reference-contract.md");

/** Locate the maintainer contract relative to the repo root that holds `.claude/`. */
export function resolveContractPath(claudeDir: string): string {
	return path.join(path.dirname(claudeDir), CONTRACT_REL_PATH);
}

// Files allowed to mention banned paths (because they DEFINE the bans).
// Kept byte-identical to the Python twin's FILE_WHITELIST.
export const FILE_WHITELIST = new Set([
	"skills/skill-creator/references/skill-authoring-rules.md",
	// The shipped checker names the maintainer-only contract it reads; it is the one
	// shipped file permitted to do so, because that is its own resolution logic.
	"scripts/check-docs-references.py",
]);
