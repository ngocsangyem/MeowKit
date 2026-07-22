---
name: "rule-model-selection-rules"
description: "rule-model-selection-rules"
---

# Claude Code Model-Selection Adapter

These rules are the Claude Code adapter for model selection. Generic skills emit provider-neutral task tiers; this adapter maps those tiers to the models available in Claude Code.
The orchestrator agent MUST declare the tier before any task begins.

## Routing Table

| Task Type                  | Model Tier                     | Reasoning Level | Examples                                                                             |
| -------------------------- | ------------------------------ | --------------- | ------------------------------------------------------------------------------------ |
| **Complex architecture**   | COMPLEX (Best available: Opus) | High            | System design, security audit, multi-module refactor, auth/payments, database schema |
| **Feature implementation** | STANDARD (Default: Sonnet)     | Medium          | Feature < 5 files, bug fix, test writing, API endpoint, UI component                 |
| **Quick edits**            | TRIVIAL (Cheapest: Haiku)      | Low/Off         | Rename, typo, format, version bump, config change, comment update                    |
| **Code review**            | COMPLEX (Best available)       | High            | Structural audit, security review, architecture review                               |
| **Research/analysis**      | STANDARD or COMPLEX            | Medium-High     | Technical research, dependency analysis, performance profiling                       |

Source: prompt-crafting-for-different-models.md — Model Selection Strategy table

> Note: TRIVIAL (cosmetic: rename, typo, format) is distinct from MICRO-TASK (non-production logic <30 lines). MICRO-TASK is only relevant when TDD is enabled (`MEOWKIT_TDD=1` / `--tdd`) — it exempts non-production code from the RED-phase requirement. In default mode (TDD off), the exemption is moot since no RED gate exists. See tdd-rules.md.

## Rules

### Rule 1: Declare before work

ALWAYS print the model tier assignment before starting any task:
`Task complexity: [TRIVIAL|STANDARD|COMPLEX] → using [model tier]`

WHY: Explicit routing prevents overpaying for trivial work and underrouting security work.

### Rule 2: Escalate on security

ALWAYS use COMPLEX tier for any task involving:

- Authentication or authorization logic
- Payment processing
- Credential handling
- Security audit or vulnerability fix
- Database schema changes with CASCADE
- Data loss / migration (CASCADE DELETE, ALTER TABLE without backup, irreversible schema change)
- External provider behavior (third-party API contract change, payment-provider migration, webhook ingress, SSO IdP)
- Removing or weakening validation requirements (deleting input checks, relaxing schema constraints, dropping rate limits)

WHY: Security-sensitive work needs maximum reasoning, including risks vertical CSV matching can miss.

The `risk-checklist.md` rule emits a `matched_flags` array at Phase 0; any
flag in `{AUTH, AUTHZ, DATA_MODEL, AUDIT_SEC, EXT_SYSTEM}` triggers this
escalation regardless of CSV match.

### Rule 3: Never downgrade mid-task

Once a task is assigned a tier, NEVER downgrade to a cheaper tier mid-task.
If the task turns out simpler than expected, complete it at the assigned tier.

WHY: Mid-task downgrades lose reasoning context and create phase inconsistency.

### Rule 4: Domain Override

When `mk:scale-routing` returns a domain match with `level=high`, the model tier MUST be COMPLEX (best available) regardless of any other signal — including manual classification.

WHY: High-complexity domains carry risks where weaker-model savings are not worth failure cost. See `rules/scale-adaptive-rules.md` and `mk:scale-routing/data/domain-complexity.csv`.

### Rule 5: Harness Density Follows Tier

For `mk:autobuild` runs, the model tier auto-selects a scaffolding density (`MINIMAL | FULL | LEAN`).

**Auto-detection:** `handlers/model-detector.cjs` reads the `model` field from SessionStart stdin and writes tier + density to `session-state/detected-model.json`. `MEOWKIT_MODEL_HINT` is now a fallback, not a requirement. Detection cascade: (1) stdin `model` field, (2) `MEOWKIT_MODEL_HINT` env var, (3) default STANDARD/FULL.

**Density override:** `MEOWKIT_AUTOBUILD_MODE=MINIMAL|FULL|LEAN` env var overrides auto-detected density.

**Single source of truth:** the full decision matrix and rationale live at `.agents/skills/autobuild/references/adaptive-density-matrix.md`. See also `scale-adaptive-rules.md` Rule 6.

WHY: Dead-weight thesis — capable models need less scaffolding; forcing FULL can degrade output.