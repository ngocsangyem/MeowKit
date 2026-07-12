/**
 * Timestamp source, isolated so tests can assert format without freezing time.
 * Kept trivial on purpose — the only reason it is a module is to give approval
 * and rehash a single, mockable clock seam.
 */

/** Current time as an ISO-8601 string. */
export function nowIso(): string {
	return new Date().toISOString();
}
