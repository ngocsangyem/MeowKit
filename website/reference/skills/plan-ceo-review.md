---
title: "meow:plan-ceo-review"
description: "CEO/founder-mode plan review — rethink the problem, challenge premises, find the 10-star product with scope expansion options."
---
# meow:plan-ceo-review
CEO/founder-mode plan review — rethink the problem, challenge premises, find the 10-star product.
## What This Skill Does
Reviews plans from a CEO/founder perspective. Four modes: Scope Expansion (dream big), Selective Expansion (hold scope + cherry-pick), Hold Scope (maximum rigor), Scope Reduction (strip to essentials). Challenges whether you're thinking big enough and whether the plan solves the real problem.
## Core Capabilities
- **Four modes** — Expand, Selective Expand, Hold, Reduce
- **Premise challenging** — Questions assumptions in the plan
- **10-star product thinking** — What would make this 10x better?
- **Review dashboard** — Tracks review status for `/meow:ship`
## Usage
```bash
/meow:plan-ceo-review                    # default mode
/meow:plan-ceo-review --scope-expand     # dream big
/meow:plan-ceo-review --hold-scope       # maximum rigor
/meow:plan-ceo-review --reduce-scope     # strip to essentials
```
::: info Skill Details
**Phase:** 1  
**Used by:** planner agent
:::

## Gotchas

- **Scope expansion beyond available resources**: "10-star thinking" produces a plan that would take 6 months → Always anchor expansion ideas to current sprint capacity
- **Missing deadlines chasing ambition**: Perfecting the plan instead of shipping MVP → Set a time-box for review; output "ship as-is" or "one targeted improvement"

## Output — Print & Stop

This skill ends with a **Print & Stop**:
- Prints a handoff block with the `/meow:cook [plan path]` command
- Stops — Claude will not proceed automatically
- You run `/meow:cook [plan path]` when ready, or run `meow:plan-eng-review` for engineering review first

Does NOT auto-chain into meow:plan-eng-review or start Phase 2. You control the review sequence.

## Related
- [`meow:plan-eng-review`](/reference/skills/plan-eng-review) — Engineering review (complements CEO review)
- [`meow:plan-creator`](/reference/skills/plan-creator) — Creates the plan that CEO review examines
- [`meow:office-hours`](/reference/skills/office-hours) — Use before plan reviews
