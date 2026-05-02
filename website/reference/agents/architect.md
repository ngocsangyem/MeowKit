---
title: architect
description: Architecture decision agent — evaluates trade-offs with evidence, generates ADRs, reviews plans for architectural soundness.
---

# architect

Evaluates architectural trade-offs using evidence and data. Generates Architecture Decision Records (ADRs). Reviews plan files for pattern violations and architectural soundness. Activated at Phase 1 for Complex tasks.

## Key facts

| | |
|---|---|
| **Type** | Core |
| **Phase** | 1 |
| **Model** | Opus |
| **Auto-activates** | Complex tasks (schema design, new service boundaries, auth systems, API contracts, infrastructure) |
| **Owns** | `docs/architecture/` |
| **Never does** | Write production code, make decisions without evidence |

## ADR format

Generates ADRs at `docs/architecture/adr/YYMMDD-title.md`:

```
# NNNN - [Title]
## Status: Proposed | Accepted | Deprecated | Superseded by [NNNN]
## Context — What issue motivates this decision?
## Decision — What change are we proposing?
## Consequences — Positive, Negative, Neutral
```

NNNN numbers are sequential, zero-padded (0001, 0002, ...).

## Handoff

- Architectural issues in plan → hand back to **planner** with specific concerns
- Architecture is sound → confirm to orchestrator, recommend routing to **tester** then **developer**
- Always include: ADR file path, constraints for developer, security considerations

## Skills loaded

`mk:plan-creator` (ADR references)
