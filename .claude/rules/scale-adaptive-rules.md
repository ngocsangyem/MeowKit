# Scale-Adaptive Routing Rules

These rules govern how the orchestrator uses domain-based complexity routing at Phase 0.

## Rule 1: CSV Match Overrides Manual Classification

When `meow:scale-routing` returns a domain match, its complexity level OVERRIDES the orchestrator's manual classification.

WHY: Domain-specific signals (e.g., "payment" → fintech → high) are more reliable than subjective judgment. The CSV is auditable and version-controlled; gut feelings are not.

INSTEAD of: Orchestrator guessing "this looks standard" → CSV determines "fintech signals detected → COMPLEX."

## Rule 2: No Match Falls Back Gracefully

When `meow:scale-routing` returns "unknown" (no domain keywords matched), the orchestrator falls back to existing manual classification per `model-selection-rules.md`.

WHY: The CSV cannot cover every domain. Fallback ensures zero regression for unrecognized task types. The system should never be LESS capable than before the CSV existed.

## Rule 3: High Complexity Forces COMPLEX Tier

When CSV returns `level=high`, the model tier MUST be COMPLEX (best available) regardless of other signals.

WHY: High-complexity domains (fintech, healthcare, IoT) have regulatory, security, and architectural requirements that cheaper models handle poorly. The cost of using a weaker model on a security-critical task vastly exceeds the savings.

INSTEAD of: "This fintech task looks simple, let's use Haiku" → "Fintech detected → COMPLEX tier, no exceptions."

## Rule 4: One-Shot Workflow Enables Gate 1 Bypass

When CSV returns `workflow=one-shot` AND the orchestrator confirms zero blast radius, Gate 1 (plan approval) may be bypassed — identical to `/meow:fix` with `complexity=simple` behavior.

WHY: Documentation typos, config tweaks, and changelog updates don't need a planning phase. The CSV codifies which domains qualify for this fast path.

GUARD: Both conditions must be true (CSV says one-shot AND zero blast radius). If either is false, Gate 1 is required.

## Rule 5: Users Can Extend the CSV

The `domain-complexity.csv` file is user-editable. Teams should add rows for their project's specific domains and conventions.

WHY: No framework can anticipate every domain. Extensibility ensures the routing stays relevant as projects evolve. The CSV is the mechanism for project-specific intelligence.

## Rule 6: Adaptive Density Emission (Phase 5 — 260408)

When `meow:scale-routing` returns a tier classification, it ALSO emits a `harness_density` field (`MINIMAL | FULL | LEAN`) for `meow:harness` consumers.

**Single source of truth:** the full decision matrix lives at `.claude/skills/meow:harness/references/adaptive-density-matrix.md`. Do NOT duplicate the table here — it drifts. This rule references the matrix; the matrix is authoritative.

WHY: Capable models (Opus 4.6+ with auto-compaction + 1M context) **degrade** when forced through full harness scaffolding — Anthropic's measured "dead-weight thesis" finding. The density policy operationalizes this.

Override: `MEOWKIT_HARNESS_MODE=MINIMAL|FULL|LEAN` env var overrides auto-detection. Logged in the harness run report.

GUARD: Density choice does NOT bypass any gate. Gate 1 (plan), Gate 2 (review verdict), and the active-verification HARD GATE on evaluator verdicts ALL still apply regardless of density mode.
