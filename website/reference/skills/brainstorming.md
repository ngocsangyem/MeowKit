---
title: "mk:brainstorming"
description: "Structured technical ideation — explore solutions, compare approaches, score trade-offs. For 'how should we build this?' not 'should we build this?'"
---

# mk:brainstorming

Explores technical solutions with structured ideation, scoring, and handoff to `mk:plan-creator`. For "how should we build this?" — NOT for "should we build this?"

## Differentiation

- `mk:office-hours` = "Should we build this?" (product validation)
- `mk:brainstorming` = "How should we build this?" (technical approach)
- `mk:plan-ceo-review` = plan already exists, want to challenge its scope
- `mk:problem-solving` = stuck on a specific approach with forced assumptions

## When to use

- Multiple architecturally-distinct approaches exist for a known requirement
- Trade-off analysis between candidate solutions needed
- Novel problem with no obvious pattern in the codebase
- Pre-mortem / failure-mode exploration before committing to a design
- Constraint-rich problem (budget, time, stack) with narrow solution space

## Plan-first gate

Brainstorming precedes planning — it produces input FOR plans. Always skips Gate 1 (same as `mk:investigate` and `mk:office-hours`).

## Process

1. Frame the problem — state what must be solved, constraints, non-negotiables
2. Generate approaches — structured ideation with scoring (feasibility, simplicity, extensibility)
3. Compare — trade-off analysis between candidates
4. Recommend — route to `mk:plan-creator` with recommended approach
