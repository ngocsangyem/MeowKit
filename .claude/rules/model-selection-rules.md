---
source: new
original_file: n/a
adapted: no
adaptation_notes: >
  "Complex architecture → Opus, Feature implementation → Sonnet, Quick edits → Haiku"
  Cross-referenced with MeowKit's existing Model Routing table in CLAUDE.md.
---

# Model Selection Rules

These rules govern which model tier is assigned to each task.
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

> Note: TRIVIAL (cosmetic: rename, typo, format) is distinct from MICRO-TASK (non-production logic <30 lines). See tdd-rules.md for MICRO-TASK definition.

## Rules

### Rule 1: Declare before work

ALWAYS print the model tier assignment before starting any task:
`Task complexity: [TRIVIAL|STANDARD|COMPLEX] → using [model tier]`

WHY: Explicit routing prevents wasting expensive models on trivial tasks
and prevents using cheap models for security-critical work.

### Rule 2: Escalate on security

ALWAYS use COMPLEX tier for any task involving:

- Authentication or authorization logic
- Payment processing
- Credential handling
- Security audit or vulnerability fix
- Database schema changes with CASCADE

WHY: Security-sensitive code requires the highest reasoning capability.
Cutting corners on model tier for security work creates real vulnerabilities.

### Rule 3: Never downgrade mid-task

Once a task is assigned a tier, NEVER downgrade to a cheaper tier mid-task.
If the task turns out simpler than expected, complete it at the assigned tier.

WHY: Switching models mid-task loses reasoning context and can introduce
inconsistencies between the planning and implementation phases.

### Rule 4: Domain Override

When `meow:scale-routing` returns a domain match with `level=high`, the model tier MUST be COMPLEX (best available) regardless of any other signal — including manual classification.

WHY: High-complexity domains (fintech, healthcare, IoT, gaming) have regulatory, security, and architectural requirements that cheaper models handle poorly. The cost of using a weaker model on a security-critical task vastly exceeds the token savings. See `rules/scale-adaptive-rules.md` and `meow:scale-routing/data/domain-complexity.csv` for the domain mapping.

### Rule 5: Harness Density Follows Tier (Phase 5 — 260408)

For `meow:harness` runs, the model tier auto-selects a scaffolding density (`MINIMAL | FULL | LEAN`).

**Single source of truth:** the full decision matrix and rationale live at `.claude/skills/meow:harness/references/adaptive-density-matrix.md`. See also `scale-adaptive-rules.md` Rule 6.

WHY: Capable models (Opus 4.6+ with auto-compaction + 1M context) need less scaffolding per Anthropic's "dead-weight thesis." Forcing full harness on Opus 4.6 **degrades** output.
