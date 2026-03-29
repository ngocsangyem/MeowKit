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
