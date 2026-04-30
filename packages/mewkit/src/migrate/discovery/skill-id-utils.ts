// Skill identity helpers: parse, validate, and resolve legacy prefixes.
// Single source of truth for the mk: namespace and the meow: backward-compat alias.

const SKILL_ID_RE = /^(mk|meow):[a-z][a-z0-9-]*$/;
const BASE_RE = /^[a-z][a-z0-9-]{0,62}$/;

const seenDeprecations = new Set<string>();

/**
 * Derive the canonical skill id from frontmatter and folder name.
 * Primary path: validated frontmatter `name:` field, normalized through resolveLegacy.
 * Fallback: synthesize `mk:<base>` from the folder basename, validated against BASE_RE.
 * Throws on a folder basename that contains illegal characters (path traversal guard).
 */
export function parseSkillId(frontmatterName: string | undefined, dirName: string): string {
	if (frontmatterName && SKILL_ID_RE.test(frontmatterName)) {
		return resolveLegacy(frontmatterName);
	}
	const stripped = dirName.startsWith("meow:") ? dirName.slice(5) : dirName;
	if (!BASE_RE.test(stripped)) {
		throw new Error(`Invalid skill folder basename: "${stripped}" (must match ${BASE_RE.source})`);
	}
	return `mk:${stripped}`;
}

/**
 * Map legacy `meow:` prefix onto the new `mk:` prefix and emit a one-time stderr warning.
 * Idempotent for already-canonical ids.
 */
export function resolveLegacy(id: string): string {
	if (id.startsWith("meow:")) {
		const newId = `mk:${id.slice(5)}`;
		warnDeprecatedOnce(id, newId);
		return newId;
	}
	return id;
}

function warnDeprecatedOnce(oldId: string, newId: string): void {
	if (seenDeprecations.has(oldId)) return;
	seenDeprecations.add(oldId);
	process.stderr.write(`[mewkit] DEPRECATED: "${oldId}" → use "${newId}".\n`);
}

/** Test-only: clear the per-process dedup set so each test asserts cleanly. */
export function _resetWarnState(): void {
	seenDeprecations.clear();
}

export { SKILL_ID_RE, BASE_RE };
