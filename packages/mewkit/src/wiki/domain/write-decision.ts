// Write-decision logic. Maps a salience score + scan verdict + dup
// check onto a write decision. By construction this NEVER decides to write a
// canonical page — the strongest outcome is a candidate. Canonical pages come
// only from the human approve path in the application layer.

import type { DupCheck, InjectionVerdict, SalienceScore, WikiWriteDecision } from "./types.js";
import { isClean } from "./types.js";

/** Salience thresholds, kept in one place for tuning. */
export const SALIENCE_THRESHOLDS = {
	/** Total ≥ this proposes a candidate for human approval. */
	proposeCandidate: 8,
	/** Total ≥ this, with a strong verified signal, may auto-append to
	 * candidates.jsonl (still never a canonical page). */
	appendCandidate: 10,
} as const;

/** Minimum scan passes for a "clean" verdict to be trusted. A clean
 * verdict with fewer passes is treated as
 * incompletely scanned and quarantined — `isClean` reports findings only, it
 * does NOT imply the content was scanned enough to write. */
export const MIN_SCAN_PASSES = 2;

/** A "strong verified signal" (accepted fix + passing tests +
 * human-authored note) is encoded as the verified_outcome component at its max.
 * Callers set verified_outcome to 3 only when that bundle holds. */
function hasStrongVerifiedSignal(score: SalienceScore): boolean {
	return score.components.verified_outcome >= 3;
}

/**
 * Decide what to do with a proposed write. Precedence:
 *  1. Any injection/secret finding → quarantine (security wins over salience).
 *  2. A clean verdict with too few scan passes → quarantine (incompletely scanned).
 *  3. High duplication → link to the existing page, never a new one.
 *  4. Total ≥ 10 with a strong verified signal → append to candidates.jsonl.
 *  5. Total ≥ 8 and scan clean → propose a candidate for approval.
 *  6. Otherwise → discard.
 */
export function decideWrite(score: SalienceScore, verdict: InjectionVerdict, dup: DupCheck): WikiWriteDecision {
	if (!isClean(verdict)) {
		return {
			kind: "quarantine",
			reason: `scan found ${verdict.status}; quarantined`,
		};
	}

	if (verdict.passes < MIN_SCAN_PASSES) {
		return {
			kind: "quarantine",
			reason: `scan incomplete (${verdict.passes} < ${MIN_SCAN_PASSES} passes); quarantined pending full scan`,
		};
	}

	if (dup.isHighDuplicate && dup.existingPageId) {
		return {
			kind: "link-existing",
			existingPageId: dup.existingPageId,
			reason: "high duplication; linked to existing page",
		};
	}

	if (score.total >= SALIENCE_THRESHOLDS.appendCandidate && hasStrongVerifiedSignal(score)) {
		return {
			kind: "append-candidate",
			reason: `salience ${score.total} ≥ ${SALIENCE_THRESHOLDS.appendCandidate} with verified signal`,
		};
	}

	if (score.total >= SALIENCE_THRESHOLDS.proposeCandidate) {
		return {
			kind: "propose-candidate",
			reason: `salience ${score.total} ≥ ${SALIENCE_THRESHOLDS.proposeCandidate}`,
		};
	}

	return {
		kind: "discard",
		reason: `salience ${score.total} below threshold ${SALIENCE_THRESHOLDS.proposeCandidate}`,
	};
}
