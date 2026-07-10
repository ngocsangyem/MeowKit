---
phase: 7
title: "End-to-End Validation Matrix"
status: pending
effort: "M"
priority: P2
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: End-to-End Validation Matrix

## Overview

Per-phase TDD tests land inside Phases 1–6; this phase adds only the **cross-phase** scenarios: full-lifecycle drills on realistic fixture projects, the provider parity matrix generated from test results, and CLI entrypoint coverage. Goal (audit §8 Phase 7): test production execution paths, not schemas and pure functions.

## Key Insights (verified)

- Existing migration E2E tests assert a synthetic scenario that cannot occur with shipping settings (`migrate-e2e-harness.ts:122-145` builds Bash-only registrations); Phase 3's golden fixtures fix migration specifically — this phase applies the same "canonical fixtures only" rule to lifecycle drills.
- Runtime probes in the audit kept the working tree clean via /tmp builds with read-only symlinked deps — reuse that discipline for drill harnesses.
- The audit's hard-gate behavioral probe covers Gate 1/privacy/injection/shell; contract-gate and verification paths were never probed — Phase 2 extends `doctor --hard-gates`; this phase runs those probes inside CI drills.
- 54 migration test files + hook/plugin/inventory/wiki suites exist; the missing layer is scenario tests that cross subsystem boundaries (state → gate → verdict → resume).

## Requirements

- Functional test scenarios (each automated, each on canonical fixtures):
  1. Fresh init → plan → source write blocked → plan activated → write allowed → verify → RESULT recorded → stop → resume restores plan/phase/blockers/next action.
  2. Unapproved / stale / wrong-slug plan cannot unlock writes while another run is active.
  3. Missing / unparseable / negative verdict blocks completion; affirmative scoped verdict passes.
  4. Compaction safety: post-compaction session re-arms context rules (sentinel behavior per Phase 2 semantics).
  5. Shipping settings → every provider transform (golden matrix, from Phase 3, executed across all 16 providers).
  6. Equipped tool absent → capability probe reports unavailable → dependent flow degrades cleanly with actionable message.
  7. Two parallel sessions on one checkout → session-scoped runs stay isolated (Phase 1 design); conflicting plan writes detected/reconciled per authority rules (Markdown canonical).
- Fixtures: shipping `settings.json` (never synthetic matcher substitutes for enforcement tests); three small fixture projects — Node, Python, polyglot. **Cut (red team, YAGNI):** the trace corpus / adherence-scoring fixture is deferred — no phase implements a scorer, and shipping a producer with no consumer is the exact defect pattern this plan eliminates. Revisit only when a scoring consumer is actually planned.
- Non-functional: drills leave working trees clean; suites runnable locally and in CI; flaky-prone probes isolated and retryable.

## Related Code Files

- Create: `packages/mewkit/src/__e2e__/` (or repo-level `e2e/`) drill harness + the 7 scenario suites; fixture projects under test fixtures dir; parity-matrix generator emitting a per-provider table from golden/scenario results (consumed by `providers` output and docs); gap-fill CLI entrypoint tests for commands still lacking flag/exit-code coverage after Phases 1–6 (candidates: init, upgrade, validate, inventory, migrate, state, task, doctor, build-plugin, wiki, memory, verdict-gate).
- Modify: `.github/workflows/ci.yml` (drill + matrix jobs), `providers`/docs surfaces to consume the generated parity matrix.
- Delete: none; synthetic-only assertions superseded by golden equivalents get retired case-by-case during review.

## Implementation Steps

1. Build the drill harness: temp-dir project setup from fixtures, CLI compiled from source, read-only dep linking, tree-cleanliness assertion in teardown.
2. Implement scenarios 1–4 (lifecycle/state/gates) against the Node fixture; then 6–7; scenario 5 wires the Phase 3 golden suite across all providers.
3. Generate the provider parity matrix from actual test results (not hand-written claims); publish via `providers` and generated docs (inventory-integrated, Phase 4 pattern).
4. Add CLI entrypoint tests (help/flags/exit codes) as **gap-fill only** (red team): Phases 1–6 own unit/producer tests for the surfaces they build; this step first inventories existing coverage, then adds entrypoint smoke tests only for commands still lacking it (including the ones help previously omitted). No duplicated suites.
5. Wire everything into CI with a fast subset on PR and the full matrix on main/nightly.
6. Verification-proof rule: any test asserting "verified" must rerun or capture the verification command itself — agent/self-reported pass is never accepted as proof (audit "không nên copy" #3).

## Success Criteria

- [ ] All 7 scenarios automated, green in CI, and running on canonical fixtures only.
- [ ] Cold-start resume drill passes without any human-authored session context.
- [ ] Provider parity matrix is generated from test results and matches published provider role declarations.
- [ ] Every critical CLI command has entrypoint/flag/exit-code coverage.
- [ ] Working tree clean after every drill run (asserted in teardown).
- [ ] No test accepts self-reported verification as evidence.

## Risk Assessment

- **E2E flakiness erodes trust:** deterministic fixtures, no network in drills, retry-with-report only for probe-class checks; quarantine lane for flaky cases with an owner and deadline.
- **CI time balloons:** PR subset (~scenarios 1–3 + Codex golden) vs full nightly matrix.
- **Fixture projects drift from real-world shapes:** keep them minimal but real (installable, runnable).
