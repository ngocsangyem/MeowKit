---
title: brainstormer
description: "Solution brainstorming agent that evaluates 2-3+ approaches with brutal honesty and second-order effect analysis."
---

# brainstormer

Solution brainstorming agent that evaluates 2-3+ approaches with brutal honesty and second-order effect analysis.

## Overview

The brainstormer sits alongside the planner in Phase 1 and provides multi-approach evaluation. For every decision, it explores 2-3+ viable approaches, documents how each works, lists pros/cons, and identifies when to choose each. It's designed to be brutally honest — if an idea is bad, it says so with evidence. It considers second-order effects: what does this decision make easier, what does it make harder, and what future options does it close.

The brainstormer is read-only with WebSearch access. It never writes code.

## Quick Reference

### Creative & Research

| Capability | Details |
|-----------|---------|
| **Multi-approach evaluation** | 2-3+ viable options for every decision |
| **Brutal honesty** | Bad ideas called out with evidence |
| **Second-order effects** | What each option makes easier/harder long-term |
| **WebSearch access** | Can research current best practices and alternatives |
| **Read-only** | Never writes code, tests, or configs |

## How to Use

```bash
# Direct invocation
"Should I use WebSockets or SSE for real-time updates?"
"Evaluate monorepo vs polyrepo for our microservices"
"What's the best auth strategy for a mobile + web app?"

# Usually routed by orchestrator during complex planning
```

## Under the Hood

### Handoff Example

```
User: "Should we use GraphQL or REST for our API?"

Brainstormer output:
  Approach 1: REST
    How: Standard resource-based endpoints
    Pros: Simple, well-understood, excellent caching
    Cons: Over/under-fetching, many endpoints
    Choose when: CRUD-heavy, simple data needs

  Approach 2: GraphQL
    How: Single endpoint, client-defined queries
    Pros: Flexible queries, typed schema, single round-trip
    Cons: Complexity, caching harder, N+1 problem
    Choose when: Complex data relationships, mobile clients

  Approach 3: tRPC
    How: End-to-end type-safe RPC
    Pros: Zero overhead types, simple, fast
    Cons: TypeScript only, less ecosystem
    Choose when: Full-stack TypeScript, internal APIs

  Second-order: GraphQL closes the door on simple caching.
                REST closes the door on flexible mobile queries.
                tRPC closes the door on non-TypeScript clients.

  → Feeds into planner's Technical Approach section
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Only one approach explored | Task may be too straightforward | Ask brainstormer to explore alternatives anyway |
| Recommendations without evidence | Shouldn't happen (enforced) | All claims must be grounded in evidence |
| WebSearch unavailable | Network or tool restriction | Brainstormer proceeds with built-in knowledge, notes limitation |
