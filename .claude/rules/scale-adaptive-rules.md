# Scale-Adaptive Routing Rules

These rules govern how the orchestrator uses domain-based complexity routing at Phase 0.

## Rule 1: CSV Match Overrides Manual Classification

When `mk:scale-routing` returns a domain match, its complexity level OVERRIDES the orchestrator's manual classification.

WHY: Versioned domain signals are more reliable than subjective tier guesses.

## Rule 2: No Match Falls Back Gracefully

When `mk:scale-routing` returns "unknown" (no domain keywords matched), the orchestrator falls back to existing manual classification per `model-selection-rules.md`.

WHY: Fallback prevents regression for unrecognized task types.

## Rule 3: High Complexity Forces COMPLEX Tier

When CSV returns `level=high`, the model tier MUST be COMPLEX (best available) regardless of other signals.

WHY: High-complexity domains carry risk where weaker-model savings are not worth the failure cost.

## Rule 4: One-Shot Workflow Enables Gate 1 Bypass

When CSV returns `workflow=one-shot` AND the orchestrator confirms zero blast radius, Gate 1 (plan approval) may be bypassed — identical to `/mk:fix` with `complexity=simple` behavior.

WHY: The CSV codifies safe fast-path domains.

GUARD: Both conditions must be true (CSV says one-shot AND zero blast radius). If either is false, Gate 1 is required.

## Rule 5: Users Can Extend the CSV

The `domain-complexity.csv` file is user-editable. Teams should add rows for their project's specific domains and conventions.

WHY: User-editable rows keep routing relevant to project-specific domains.

## Rule 6: Adaptive Density Emission (Phase 5 — 260408)

When `mk:scale-routing` returns a tier classification, it ALSO emits a `autobuild_density` field (`MINIMAL | FULL | LEAN`) for `mk:autobuild` consumers.

**Single source of truth:** the full decision matrix lives at `.claude/skills/autobuild/references/adaptive-density-matrix.md`. Do NOT duplicate the table here — it drifts. This rule references the matrix; the matrix is authoritative.

WHY: Dead-weight thesis — over-scaffolding degrades capable models.

Override: `MEOWKIT_AUTOBUILD_MODE=MINIMAL|FULL|LEAN` overrides auto-detection and is logged.

GUARD: Density choice does NOT bypass any gate. Gate 1 (plan), Gate 2 (review verdict), and the active-verification HARD GATE on evaluator verdicts ALL still apply regardless of density mode.

## Rule 7: Auto-Strict for High-Complexity Cook Runs

When `mk:scale-routing` returns `level=high` during a `/mk:cook` run, the cook workflow MUST auto-enable `--strict` mode (full mk:evaluate) at Phase 4.5 — unless the user explicitly passes `--no-strict`.

WHY: High-complexity domains need runtime proof that structural review can miss.

GUARD: Auto-strict fires ONLY in mk:cook, NOT in mk:fix, mk:autobuild (which has its own evaluator), or standalone mk:review. The `--no-strict` flag is the user escape hatch.

Evaluator drives the running app and verifies critical flows end-to-end.
