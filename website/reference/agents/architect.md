---
title: architect
description: System design specialist — evaluates architectural tradeoffs with evidence and generates Architecture Decision Records (ADRs).
---

# architect

The architect is your system design specialist. When a task touches database schemas, API contracts, service boundaries, or infrastructure, the architect steps in to evaluate tradeoffs with data — not opinion — and document decisions in Architecture Decision Records (ADRs) that the entire team can reference.

## Cognitive Framing

> *"Every architectural decision has consequences. The architect makes sure those consequences are documented before code is written."*

The architect operates at Phase 1 alongside the planner, specifically for Complex tasks involving structural changes. It owns `docs/architecture/` and ensures that no new pattern enters the codebase without a documented rationale and tradeoff analysis.

## Key Facts

| | |
|---|---|
| **Type** | Core |
| **Phase** | 1 (Plan) |
| **Auto-activates** | Complex tasks involving schema, API, or infrastructure changes |
| **Owns** | `docs/architecture/` (all ADR files and architecture docs) |
| **Never does** | Write implementation code, make recommendations based on opinion alone, override security BLOCK verdicts |

## When to Use

- When a task involves **database schema changes**, new service boundaries, or API contract modifications.
- When the orchestrator classifies a task as **Complex** and architectural decisions are needed.
- When you need to **evaluate multiple architectural approaches** before committing to one.
- When an existing ADR needs to be **superseded** by a new decision.
- When the planner flags architectural concerns in the plan file.

## Key Capabilities

- **Evidence-based tradeoff evaluation** — every recommendation includes reasoning and documented consequences (positive, negative, and neutral).
- **ADR generation** — produces Architecture Decision Records at `docs/architecture/adr/YYMMDD-title.md` with sequential numbering, following a standardized template (Status, Context, Decision, Consequences).
- **Plan review** — reviews plan files for architectural soundness, flags pattern violations and missing considerations.
- **Pattern identification** — detects when a change introduces new patterns and ensures they are documented, or flags when existing patterns are violated.

## Behavioral Checklist

- [x] Evaluates tradeoffs using evidence and data, not opinion
- [x] Generates ADRs with documented consequences for every architectural decision
- [x] Reviews plan files for architectural soundness
- [x] Identifies new patterns and ensures documentation
- [x] Flags conflicts with existing ADRs
- [x] Never makes architectural decisions without documenting consequences
- [x] Hands back to planner if plan has architectural issues
- [x] Respects security agent BLOCK verdicts — never overrides them

## Common Use Cases

| Scenario | What the architect does |
|---|---|
| "We need to add a new microservice" | Evaluates service boundary tradeoffs, generates an ADR documenting the decision, constraints, and consequences |
| "Should we use PostgreSQL or MongoDB?" | Produces a tradeoff analysis with evidence, documents the decision in an ADR |
| "The API needs versioning" | Reviews existing API patterns, proposes a versioning strategy with ADR, flags breaking change implications |
| "Refactor the auth system to use JWT" | Evaluates security implications, generates ADR, coordinates with security agent for audit |

## Pro Tips

### Document Alternatives, Not Just the Decision

The most valuable part of an ADR is the "Consequences" section and the alternatives that were considered. When a future developer asks "why didn't we use X?", the ADR should answer that question directly. Always document at least two alternatives for any significant decision.

### Use ADRs to Prevent Pattern Drift

If you notice the same architectural question coming up repeatedly, it likely means an existing ADR is unclear or missing. Proactively generate ADRs for patterns that developers keep re-asking about — this saves decision-making time across the team.

## Key Takeaway

The architect ensures that structural decisions are made deliberately and documented permanently. By requiring evidence for every recommendation and recording consequences in ADRs, it prevents the "we did it this way because someone said so" problem that plagues long-lived codebases.

## Related Agents

- **[planner](/reference/agents/planner)** — hands off to the architect when architectural decisions are needed; receives back confirmation or concerns
- **[developer](/reference/agents/developer)** — follows architectural constraints set by ADRs; cannot introduce new patterns without an ADR
- **[security](/reference/agents/security)** — coordinates on security-related architectural decisions; architect respects security BLOCK verdicts
- **[reviewer](/reference/agents/reviewer)** — checks architecture fit during the review phase using ADRs as reference
