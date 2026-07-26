// Evidence revision + supersession for the workflow evidence index.
//
// Canonical contract: `.claude/rules-conditional/workflow-evidence-rules.md` and
// `.claude/rules-conditional/advice-supervision-rules.md` §6.
//
// The problem this solves: `RETURN_TO_EXECUTOR` sends work back to its owner, the
// owner changes source, and the Verify output and review verdict recorded earlier
// now describe code that no longer exists. Nothing in the index said so, so stale
// evidence kept reading as current at the next gate and at ship preflight. Binding
// evidence to a revision is what makes "this proof is out of date" expressible.
//
// Two revisions, because two different approvals go stale at different times:
//   `evidenceRevision` — bumped by ANY source correction. Verify/review evidence
//                        recorded at a lower revision is superseded.
//   `scopeRevision`    — bumped only when the plan or scope itself changed. Gate 1
//                        approved before that point no longer covers the work.
//
// An in-scope source fix keeps Gate 1 and invalidates only downstream evidence; a
// scope change invalidates both. Collapsing them into one counter would force a
// fresh human plan approval after every ordinary correction, which trains people to
// click through the gate that matters.
//
// The status field is STORED (the artifact is read by humans) and CHECKED against
// the revisions (so it cannot lie). A stored `valid` that contradicts the numbers is
// a violation, not a value to trust.

/** Whether recorded evidence still describes the current source state. */
export const EVIDENCE_STATUSES = ["valid", "superseded"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

/** What kind of change a `RETURN_TO_EXECUTOR` correction produced. */
export const CORRECTION_KINDS = ["source", "scope"] as const;
export type CorrectionKind = (typeof CORRECTION_KINDS)[number];

/**
 * The revision-bearing subset of the evidence index. Deliberately a partial view:
 * this module owns supersession and nothing else, and the index's other fields are
 * validated by `.claude/scripts/validate-workflow-evidence.cjs`.
 */
export interface RevisionBearingIndex {
	evidenceRevision?: number;
	scopeRevision?: number;
	verification?: { evidenceRevision?: number; status?: string; [k: string]: unknown };
	review?: { evidenceRevision?: number; status?: string; [k: string]: unknown };
	approvals?: { gate1?: string; gate2?: string; gate1Revision?: number; [k: string]: unknown };
	[k: string]: unknown;
}

/**
 * Current source revision. Absent means 1, so every index written before this
 * mechanism existed reads as revision 1 with nothing superseded — the feature is
 * additive and cannot retroactively block an old run.
 */
export const currentRevision = (index: RevisionBearingIndex): number =>
	Number.isInteger(index.evidenceRevision) ? (index.evidenceRevision as number) : 1;

/** Revision at which scope last changed. 0 means it never has. */
export const scopeRevision = (index: RevisionBearingIndex): number =>
	Number.isInteger(index.scopeRevision) ? (index.scopeRevision as number) : 0;

/** Evidence recorded at `recorded` is stale once the source has moved past it. */
export function evidenceStatusOf(recorded: number | undefined, current: number): EvidenceStatus {
	const at = Number.isInteger(recorded) ? (recorded as number) : current;
	return at < current ? "superseded" : "valid";
}

/**
 * Apply a correction: advance the revision and mark downstream evidence superseded.
 *
 * Gate 2 is demoted from `approved` back to `required` because the verdict it rests
 * on is now stale. Gate 1 is demoted only for a scope correction. Neither is ever
 * promoted here — this function can invalidate an approval, never grant one.
 */
export function applyCorrection<T extends RevisionBearingIndex>(index: T, kind: CorrectionKind): T {
	const next = currentRevision(index) + 1;
	const approvals = { ...(index.approvals ?? {}) };

	if (approvals.gate2 === "approved") approvals.gate2 = "required";
	if (kind === "scope" && approvals.gate1 === "approved") approvals.gate1 = "required";

	return {
		...index,
		evidenceRevision: next,
		scopeRevision: kind === "scope" ? next : scopeRevision(index),
		verification: { ...(index.verification ?? {}), status: "superseded" as const },
		review: { ...(index.review ?? {}), status: "superseded" as const },
		approvals,
	};
}

/**
 * Record fresh evidence at the current revision. Used after a correction's re-run,
 * so the new Verify/review output is bound to the source state it actually observed.
 */
export function markCurrent<T extends RevisionBearingIndex>(index: T, field: "verification" | "review"): T {
	const rev = currentRevision(index);
	return { ...index, [field]: { ...(index[field] ?? {}), evidenceRevision: rev, status: "valid" as const } };
}

/**
 * Supersession violations. Empty means the index is internally consistent.
 *
 * Mirrored by `.claude/scripts/validate-workflow-evidence.cjs`, which is the
 * shipped validator for projects with no TypeScript build. A parity test runs both
 * over the same fixtures, because two implementations of one rule drift and the
 * looser one silently becomes the contract.
 */
export function supersessionProblems(index: RevisionBearingIndex): string[] {
	const problems: string[] = [];
	const current = currentRevision(index);

	if (!Number.isInteger(current) || current < 1) return ["invalid-evidenceRevision"];
	if (scopeRevision(index) > current) problems.push("scopeRevision-ahead-of-evidenceRevision");

	for (const field of ["verification", "review"] as const) {
		const rec = index[field];
		if (!rec) continue;
		const at = rec.evidenceRevision;
		if (at !== undefined && (!Number.isInteger(at) || at < 1 || at > current)) {
			problems.push(`${field}-revision-out-of-range`);
			continue;
		}
		// A stored status that contradicts the revisions is refused rather than
		// corrected: whoever wrote `valid` over stale evidence is the caller a later
		// reader would have trusted.
		if (rec.status === "valid" && evidenceStatusOf(at, current) === "superseded")
			problems.push(`stale-${field}-marked-valid`);
	}

	// Stale by EITHER signal blocks: the revision comparison catches an index whose
	// status field was never updated, the stored status catches one whose revisions
	// were rewritten. Requiring both to agree would let either omission through.
	const staleBy = (rec: { evidenceRevision?: number; status?: string } | undefined): boolean =>
		rec !== undefined && (evidenceStatusOf(rec.evidenceRevision, current) === "superseded" || rec.status === "superseded");

	const approvals = index.approvals ?? {};
	if (approvals.gate2 === "approved" && staleBy(index.review)) problems.push("gate2-approved-on-superseded-review");
	if (approvals.gate2 === "approved" && staleBy(index.verification))
		problems.push("gate2-approved-on-superseded-verification");

	// Gate 1 covers a scope. If scope moved after the approval was recorded, the
	// approval describes a plan that is no longer the one being built.
	if (approvals.gate1 === "approved") {
		const approvedAt = Number.isInteger(approvals.gate1Revision) ? (approvals.gate1Revision as number) : 0;
		if (scopeRevision(index) > approvedAt) problems.push("gate1-approved-before-scope-change");
	}

	return [...new Set(problems)];
}
