# Mode: Default (Balanced)

## Activation

This is the default mode. Active unless another mode is explicitly selected.

## Configuration

- **Phases**: All 6 phases active (Plan → Test RED → Implement GREEN → Review → Ship → Docs Sync)
- **Gate 1 (Plan)**: Enforced. Human approval required before implementation.
- **Gate 2 (Review)**: Enforced. Human approval required before shipping.
- **Security checks**: Full security scan at Phase 2 (test) and Phase 4 (review).
- **Model routing**: Standard. Routes based on task complexity (simple → cheaper model, complex → best model).
- **Test coverage**: Project's existing coverage threshold applies.
- **Review strictness**: FAIL dimensions block shipping. WARN dimensions require acknowledgment.

## Planning Depth

- **Researchers:** 1 (single researcher investigates before planning)
- **Parallel research:** No (sequential)
- **Two approaches:** No (single plan produced)

## When to Use

This is the recommended mode for most work. It balances quality enforcement with development speed. Suitable for:
- Regular feature development
- Standard bug fixes
- Most day-to-day work

## What's Different from Other Modes

Compared to Strict: allows WARN dimensions to pass with acknowledgment (Strict requires all PASS).
Compared to Fast: enforces both gates fully (Fast auto-approves Gate 2 if tests pass).
Compared to specialized modes (Architect, Audit, Document): runs the full implementation pipeline.
