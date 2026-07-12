/**
 * Shared identifier patterns for the visual-plan contracts.
 *
 * Feedback batch ids are the security-sensitive one: a consumer validates the
 * id against `FEEDBACK_BATCH_ID_RE` BEFORE any path join (red-team M8), so the
 * charset is deliberately narrow — no dots, slashes, or path separators can
 * appear in a batch filename.
 */

/** Generic artifact-internal id: lowercase/uppercase alnum + hyphen/underscore. */
export const ENTITY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/**
 * Strict feedback-batch id: `feedback-<digits>-<slug>`. The fixed charset makes
 * the id safe to interpolate into a filename without traversal risk. Validated
 * before any path join.
 */
export const FEEDBACK_BATCH_ID_RE = /^feedback-\d{8,}-[a-z0-9]([a-z0-9-]{0,63})$/;

/** True when `id` is a structurally valid artifact-internal id. */
export function isValidEntityId(id: string): boolean {
	return ENTITY_ID_RE.test(id);
}

/** True when `id` is a structurally valid feedback-batch id (path-injection safe). */
export function isValidFeedbackBatchId(id: string): boolean {
	return FEEDBACK_BATCH_ID_RE.test(id);
}
