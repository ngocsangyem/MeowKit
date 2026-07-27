# Scope Challenge (Step 0)

Before research or planning begins, challenge the scope:

## Three Questions
1. **What already exists?** — Search codebase for existing solutions. Don't rebuild.
2. **What's the minimum change?** — Smallest diff that solves the problem.
3. **Is this actually complex?** — If < 3 files and < 30 min, use plan-quick or skip.

## Scope Modes
| Mode | When | Effect |
|------|------|--------|
| HOLD | Default | Plan within stated scope |
| EXPANSION | User wants to think bigger | Add adjacent improvements (document, don't add to current scope) |
| REDUCTION | Scope too large for sprint | Strip to MVP, defer the rest |

## Complexity Thresholds
- ≤ 8 files: normal
- ≤ 2 new abstractions: normal
- ≤ 3 phases: normal
- Exceeding any → challenge. Ask user to confirm or reduce.

## Skill Suggestions

During scope challenge, if the task domain matches, suggest the relevant skill:

| Domain Signal | Suggested Skill |
|---------------|----------------|
| Operations, triage, case management, billing ops, support workflows, "how should we handle X cases" | `mk:decision-framework` — structures expert judgment into repeatable decision systems |
| API contract design or review — interface shape, error semantics, compatibility, pagination | `mk:api-design-principles` — durable REST, GraphQL, RPC, or event contracts |
| Backend change end to end — handler, service, integration, webhook, job | `mk:backend-development` — coordinates contract, data, and auth owners |
| Schema, migration, query, index, or ORM data-access boundary | `mk:database` — data invariants, safe evolution, query evidence |
| Infrastructure, containers, CI/CD, deployment safety, rollback | `mk:devops` — infrastructure change safety and delivery |

Surface the suggestion as: "This looks like an [ops/API design] task — consider activating `mk:[skill]` before planning."

## Output
After scope challenge: state the chosen mode and proceed to research (if needed) or plan drafting.
