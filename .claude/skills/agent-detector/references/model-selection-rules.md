---
source: new
original_file: n/a
adapted: no
adapter_scope: claude-code
adaptation_notes: >
  "Complex architecture → Opus, Feature implementation → Sonnet, Quick edits → Haiku"
  Cross-referenced with the toolkit's existing Model Routing table in CLAUDE.md.
---

# Claude Code Model-Selection Adapter

These rules are the Claude Code adapter for model selection. Generic skills emit provider-neutral task tiers; this adapter maps those tiers to the models available in Claude Code.
The orchestrator agent declares the tier before a task begins.

## Contents

- [Routing Table](#routing-table)
- [Task Complexity Tiers](#task-complexity-tiers)
- [Agent `model:` Pins](#agent-model-pins)
- [Detection output](#detection-output)
- [Rules](#rules)

## Routing Table

| Task Type                  | Model Tier                     | Reasoning Level | Examples                                                                             |
| -------------------------- | ------------------------------ | --------------- | ------------------------------------------------------------------------------------ |
| **Complex architecture**   | COMPLEX (Best available: Opus) | High            | System design, security audit, multi-module refactor, auth/payments, database schema |
| **Feature implementation** | STANDARD (Default: Sonnet)     | Medium          | Feature < 5 files, bug fix, test writing, API endpoint, UI component                 |
| **Quick edits**            | TRIVIAL (Cheapest: Haiku)      | Low/Off         | Rename, typo, format, version bump, config change, comment update                    |
| **Code review**            | COMPLEX (Best available)       | High            | Structural audit, security review, architecture review                               |
| **Research/analysis**      | STANDARD or COMPLEX            | Medium-High     | Technical research, dependency analysis, performance profiling                       |

## Task Complexity Tiers

TRIVIAL, STANDARD and COMPLEX are the one task-complexity vocabulary in the kit. Other files point here instead of restating it. Quick, Standard and Deep elsewhere are skill modes or profiles, not complexity tiers.

| Tier | Routing CSV `level` | Size signals | Approach |
| --- | --- | --- | --- |
| TRIVIAL | `low` | Single file, simple fix, clear scope, explicit path | Direct implementation, skip research |
| STANDARD | `medium` | 2-5 files, feature add, some unknowns | Scout first, then implement |
| COMPLEX | `high` | 6+ files, architecture, vague scope | Research, plan, implement |

The CSV `level` values (`low`, `medium`, `high`) are data tokens that `mk:scale-routing` emits and its eval parses. They are not renamed; this table is the only place they are mapped to tiers. A CSV level is a floor: Rule 4 makes `high` binding, and size signals or a risk flag may raise the tier above `low` or `medium`.

Source: prompt-crafting-for-different-models.md — Model Selection Strategy table

> Note: TRIVIAL (cosmetic: rename, typo, format) is distinct from MICRO-TASK (non-production logic <30 lines). MICRO-TASK is only relevant when TDD is enabled (`MEOWKIT_TDD=1` / `--tdd`) — it exempts non-production code from the RED-phase requirement. In default mode (TDD off), the exemption is moot since no RED requirement exists. See .claude/skills/cook/references/tdd-rules.md.

## Agent `model:` Pins

An agent's `model:` frontmatter follows its tier in the table above. Pins are not changed per task; the tier declared for a task picks which agent runs, not which model that agent uses.

| Agent tier | `model:` value | Agents |
| --- | --- | --- |
| COMPLEX (design, review, security, judgment) | `opus` | architect, brainstormer, developer, evaluator, planner, reviewer, security, ui-ux-designer, confluence-spec-analyst, jira-analyst, jira-estimator, jira-evaluator |
| STANDARD (implementation support, research, multi-step integration work) | `sonnet` | analyst, journal-writer, orchestrator, researcher, tester, confluence-bulk, confluence-page, jira-admin, jira-bulk, jira-collaborate, jira-dev, jira-jsm, jira-lifecycle |
| TRIVIAL (mechanical, single-call or report-only) | `haiku` | documenter, explore, git-manager, project-manager, shipper, story-sizer, confluence-collaborate, confluence-search, jira-agile, jira-fields, jira-issue, jira-ops, jira-relationships, jira-search, jira-time |
| Strategy consult (one recommendation, no lifecycle phase) | `fable` | advisor, athena |

A new agent takes the pin of its tier.

## Detection output

State the result in one line, for example `Agent: architect | Tier: COMPLEX | Flags: [DATA_MODEL]`. When delegating to the agent, leave the model unset so the agent's `model:` pin applies.

## Rules

### Rule 1: Declare before work

Print the model tier assignment before starting a task:
`Task complexity: [TRIVIAL|STANDARD|COMPLEX] → using [model tier]`

WHY: Explicit routing prevents overpaying for trivial work and underrouting security work.

### Rule 2: Escalate on security

Use the COMPLEX tier for any task involving:

- Authentication or authorization logic
- Payment processing
- Credential handling
- Security audit or vulnerability fix
- Database schema changes with CASCADE
- Data loss / migration (CASCADE DELETE, ALTER TABLE without backup, irreversible schema change)
- External provider behavior (third-party API contract change, payment-provider migration, webhook ingress, SSO IdP)
- Removing or weakening validation requirements (deleting input checks, relaxing schema constraints, dropping rate limits)

WHY: Security-sensitive work needs maximum reasoning, including risks vertical CSV matching can miss.

The `references/risk-checklist.md` rule emits a `matched_flags` array at Phase 0; any
flag in `{AUTH, AUTHZ, DATA_MODEL, AUDIT_SEC, EXT_SYSTEM}` triggers this
escalation regardless of CSV match.

### Rule 3: Never downgrade mid-task

Once a task is assigned a tier, do not downgrade to a cheaper tier mid-task.
If the task turns out simpler than expected, complete it at the assigned tier.

WHY: Mid-task downgrades lose reasoning context and create phase inconsistency.

### Rule 4: Domain Override

When `mk:scale-routing` returns a domain match with `level=high`, the model tier is COMPLEX (best available) regardless of any other signal — including manual classification.

WHY: High-complexity domains carry risks where weaker-model savings are not worth failure cost. See `references/scale-adaptive-rules.md` and `.claude/skills/scale-routing/data/domain-complexity.csv`.

### Rule 5: Autobuild density is not chosen here

`mk:autobuild` picks its own scaffolding density from the detected model. The decision matrix and the override live in `.claude/skills/autobuild/references/adaptive-density-matrix.md`; this file does not restate them.
