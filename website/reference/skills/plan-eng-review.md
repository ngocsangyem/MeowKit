---
title: "meow:plan-eng-review"
description: "Engineering manager-mode plan review — architecture, data flow, edge cases, test coverage, and performance analysis."
---
# meow:plan-eng-review
Engineering manager-mode plan review — architecture, data flow, edge cases, test coverage, and performance.
## What This Skill Does
Reviews plans from an engineering manager perspective. Walks through architecture, data flow, diagrams, edge cases, test coverage, and performance interactively with opinionated recommendations. This is the review that **gates shipping** by default.
## Core Capabilities
- **Architecture review** — Evaluates system design decisions
- **Data flow analysis** — Traces data from input to storage to output
- **Edge case identification** — Finds scenarios the plan doesn't cover
- **Test coverage planning** — Recommends test strategy before implementation
- **Search-before-building** — Verifies patterns against current best practices
## Usage
```bash
/meow:plan-eng-review          # review the current plan
"engineering review"           # auto-triggers
"lock in the plan"            # auto-triggers
```
## Related
- [`meow:plan-ceo-review`](/reference/skills/plan-ceo-review) — Product/strategy perspective
- [`meow:review`](/reference/skills/review) — Code-level review (after implementation)
