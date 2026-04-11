---
title: "meow:party"
description: "Multi-agent deliberation for architecture decisions. 2-4 agents debate, synthesize, and produce a decision brief — no code written."
---

# meow:party

Multi-agent deliberation for architecture decisions. Spawn 2-4 agents with different lenses, force them to disagree, then synthesize into a single recommendation.

## What This Skill Does

`meow:party` is a discussion-only skill — no code is written during a party. It spawns 2-4 deliberation agents with distinct analytical lenses (performance, developer experience, migration cost, security). Each agent independently analyzes the question, reaches a conclusion, then a synthesis agent reconciles the positions into a single actionable recommendation.

Use it when two reasonable engineers would disagree, when the decision has long-term consequences, or when the cost of the wrong choice exceeds 2 days of rework.

## When to Use

::: tip Use meow:party when...
- Choosing between two architectural approaches (REST vs GraphQL, monolith vs microservices)
- Deciding on a database schema that will be hard to migrate
- Evaluating third-party dependencies with long-term lock-in
- Trade-off analysis where multiple concerns genuinely conflict
:::

::: warning Do NOT use meow:party for...
- Implementation decisions ("how do I write this function")
- Bug fixes with a clear root cause
- Trivial config choices
- Anything that a single senior engineer would decide in under 5 minutes
:::

## Usage

```bash
# Architecture trade-off
/meow:party "Should we use GraphQL or REST for the public API?"

# Technology selection
/meow:party "PostgreSQL or MongoDB for user sessions?"

# Design decision
/meow:party "Monorepo or polyrepo for the new services?"
```

## How It Works

```
/meow:party "question"
       │
       ▼
Spawn 2-4 deliberation agents with distinct lenses
       │
       ├── Agent A: Performance lens → independent analysis → conclusion
       ├── Agent B: DX lens          → independent analysis → conclusion
       ├── Agent C: Migration lens   → independent analysis → conclusion
       └── Agent D: Security lens    → independent analysis → conclusion (optional)
       │
       ▼
Synthesis agent reconciles positions
       │
       ▼
Decision brief: recommendation + rationale + dissenting views
       │
       ▼
Feed into ADR or plan (human decides)
```

## Example Output

```
Party Mode — "GraphQL vs REST vs tRPC for public API"

Agent A (performance): REST — GraphQL query complexity creates unpredictable
  response times at scale. N+1 problem requires DataLoader. Verdict: REST.

Agent B (DX): tRPC — Full type safety without code generation. Only downside:
  TypeScript-only. Our stack is 100% TS. Verdict: tRPC.

Agent C (migration): REST — Existing API consumers expect REST. GraphQL
  migration requires coordinated client updates. Verdict: REST.

─────────────────────────────────────────────────────────────────────────
Synthesis: tRPC for internal services (zero overhead, full TS type safety).
REST for external/public API (existing consumers, better caching, simpler).
GraphQL not recommended for this project at current scale.

Next step: Create ADR at docs/architecture/YYMMDD-api-layer-decision.md
```

## Workflow Integration

Party Mode fits into Phase 1 (Plan), before writing the ADR:

```
Phase 0: Orient
   │
   ▼ (if architectural decision detected)
/meow:party "question"     ← deliberation, no code
   │
   ▼
Decision brief
   │
   ▼
Phase 1: Plan → architect writes ADR based on party output
   │
   ▼
Gate 1: Human approval of ADR
```

::: info Skill Details
**Phase:** 1 (pre-planning)
**Used by:** architect agent, orchestrator
**Plan-First Gate:** Skips — party produces input FOR plans
**Code changes:** None — discussion only
:::

## Related

- [`meow:office-hours`](/reference/skills/office-hours) — Pre-planning brainstorming (single agent, less structured)
- [`meow:plan-ceo-review`](/reference/skills/plan-eng-review) — Engineering lens review after the decision is made
- [`/workflows/architecture`](/workflows/architecture) — Full architecture decision workflow
