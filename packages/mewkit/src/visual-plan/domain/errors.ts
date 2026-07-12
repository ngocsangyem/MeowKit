/**
 * Validation error vocabulary for the visual-plan contracts.
 *
 * Every deterministic check emits a `ValidationError` carrying an exact JSON
 * path into the artifact, a stable machine code, and a human message. The
 * `--json` reporter surfaces these verbatim so a fresh agent session can
 * self-repair a rejected artifact from the path alone.
 */

/** Stable, machine-readable error codes. Never renumber — consumers match on these. */
export const ErrorCode = {
	ARTIFACT_MISSING: "ARTIFACT_MISSING",
	ARTIFACT_INVALID_JSON: "ARTIFACT_INVALID_JSON",
	SCHEMA: "SCHEMA",
	DUPLICATE_ID: "DUPLICATE_ID",
	DANGLING_CONNECTOR_ENDPOINT: "DANGLING_CONNECTOR_ENDPOINT",
	DANGLING_ANNOTATION_TARGET: "DANGLING_ANNOTATION_TARGET",
	DANGLING_LANE: "DANGLING_LANE",
	DANGLING_COVERAGE_FRAME: "DANGLING_COVERAGE_FRAME",
	DANGLING_SOURCE_REF: "DANGLING_SOURCE_REF",
	DANGLING_REPRESENTED_BY: "DANGLING_REPRESENTED_BY",
	COVERAGE_UNRESOLVED: "COVERAGE_UNRESOLVED",
	COVERAGE_EQUIVALENCE_CYCLE: "COVERAGE_EQUIVALENCE_CYCLE",
	COVERAGE_EQUIVALENCE_UNBACKED: "COVERAGE_EQUIVALENCE_UNBACKED",
	COVERAGE_MISSING_RISK_ID: "COVERAGE_MISSING_RISK_ID",
	COVERAGE_MISSING_REPRESENTED_BY: "COVERAGE_MISSING_REPRESENTED_BY",
	UNSAFE_HTML: "UNSAFE_HTML",
	STALE_SOURCE_HASH: "STALE_SOURCE_HASH",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** One deterministic finding. `path` is a dotted/bracketed JSON path into the artifact. */
export interface ValidationError {
	path: string;
	code: ErrorCodeValue;
	message: string;
}

/** Machine-readable result of any validation pass. `ok` is derived from `errors`. */
export interface ValidationResult {
	ok: boolean;
	errors: ValidationError[];
}

/** Build a `ValidationError` (thin helper to keep call sites terse and consistent). */
export function err(path: string, code: ErrorCodeValue, message: string): ValidationError {
	return { path, code, message };
}
