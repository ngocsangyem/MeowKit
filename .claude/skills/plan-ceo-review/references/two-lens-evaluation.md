# Two-Lens Evaluation

Two independent grades, PASS, WARN or FAIL, run after the scope mode and before the deep review.

## Lens A: intent alignment

Does the plan solve the right problem?

1. It solves the stated problem, not an adjacent one.
2. Success criteria are measurable and binary.
3. Scope matches ambition: not small for a big problem, not large for a small one.
4. The problem describes a real user need with evidence, not "we should have X".

PASS: "users lose work when the session expires", solved by auto-save and session extension, criterion "zero data loss on timeout". WARN: a real problem ("improve onboarding") with a fuzzy criterion ("better NPS"). FAIL: "improve UX" answered with twelve unrelated features and no way to verify done.

## Lens B: execution credibility

Can a skilled engineer deliver this as written?

1. The timeline fits the scope (file count times complexity against the sessions estimated).
2. Technical choices carry a reason, not just a name.
3. Tasks are granular enough: a task touching 5 or more files is split.
4. Dependencies are mapped, so the order and any parallelism are clear.

PASS: 3 phases of 2-3 files each, a clear chain, reasons recorded. WARN: reasonable scope but one task touches 6 files with no breakdown. FAIL: "Phase 1: build the payment system", 15 or more files, no breakdown, estimate or dependencies.

## Verdict

Any FAIL means NEEDS REVISION; show the specific failure and a fix ("Phase 2 touches 12 files in one task; split into 3-4 with file ownership"). WARN and PASS combinations are APPROVED, with the flagged lens noted. This is the only stop in the review: the pre-screen never blocks.

If `mk:validate-plan` already ran, cite its PASS, WARN and FAIL results for scope and criteria instead of repeating those checks.
