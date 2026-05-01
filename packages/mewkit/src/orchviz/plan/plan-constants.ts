/**
 * Shared constants for the plan module — regexes used across multiple
 * files (parser, collector, listPlans, etag, find-active-plan).
 *
 * Single source of truth eliminates drift if naming conventions change.
 */

export const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
export const PHASE_FILE_RE = /^phase-\d+-.+\.md$/i;
export const PHASE_FILE_NUM_RE = /^phase-(\d+)-.+\.md$/i;
export const SLUG_RE = /^[a-zA-Z0-9_-]{1,80}$/;

/**
 * Build a regex matching `phase-NN-*.md` for a specific phase number,
 * tolerating zero-padding (R2-1): phase=1 matches both `phase-01-x.md`
 * and `phase-1-x.md`. Excludes leading-dot files (orphan tmps).
 */
export function buildPhaseNumberRe(phase: number): RegExp {
	return new RegExp(`^phase-0*${phase}-.*\\.md$`, "i");
}
