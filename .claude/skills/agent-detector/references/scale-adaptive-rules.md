# Scale-Adaptive Routing Rules

These rules govern how the orchestrator uses domain-based complexity routing at Phase 0.

## Rule 1: CSV Match Overrides Manual Classification

When `mk:scale-routing` returns a domain match, its complexity level OVERRIDES the orchestrator's manual classification.

WHY: Versioned domain signals are more reliable than subjective tier guesses.

## Rule 2: No Match Falls Back Gracefully

When `mk:scale-routing` returns "unknown" (no domain keywords matched), the orchestrator falls back to existing manual classification per `references/model-selection-rules.md`.

WHY: Fallback prevents regression for unrecognized task types.

## Rule 3: High Complexity Forces COMPLEX Tier

When CSV returns `level=high`, the tier is COMPLEX: see `references/model-selection-rules.md` (Task Complexity Tiers, Rule 4).

## Rule 4: One-Shot Workflow Skips the Plan

When CSV returns `workflow=one-shot` AND the orchestrator confirms zero blast radius, the work can proceed without a plan file — identical to `/mk:fix` with `complexity=simple` behavior.

WHY: The CSV codifies safe fast-path domains.

GUARD: Both conditions must be true (CSV says one-shot AND zero blast radius). If either is false, write the plan and agree it with the user first.

## Rule 5: Users Can Extend the CSV

The `domain-complexity.csv` file is user-editable. Teams should add rows for their project's specific domains and conventions.

WHY: User-editable rows keep routing relevant to project-specific domains.

## Rule 6: Autobuild Density Is Owned by Autobuild

`mk:scale-routing` does not emit a density. `mk:autobuild` chooses its scaffolding density from the detected model; see `.claude/skills/autobuild/references/adaptive-density-matrix.md`. Density changes the amount of scaffolding, not the work: the plan, the review verdict and the evaluator's active-verification requirement apply in every mode.

## Rule 7: Auto-Strict for High-Complexity Cook Runs

When `mk:scale-routing` returns `level=high` during a `/mk:cook` run, the cook workflow MUST auto-enable `--strict` mode (full mk:evaluate) at Phase 4.5 — unless the user explicitly passes `--no-strict`.

WHY: High-complexity domains need runtime proof that structural review can miss.

GUARD: Auto-strict fires ONLY in mk:cook, NOT in mk:fix, mk:autobuild (which has its own evaluator), or standalone mk:review. The `--no-strict` flag is the user escape hatch.

Evaluator drives the running app and verifies critical flows end-to-end.
