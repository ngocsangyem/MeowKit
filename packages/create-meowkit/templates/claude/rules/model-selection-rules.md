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
