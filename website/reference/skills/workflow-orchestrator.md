---
title: "meow:workflow-orchestrator"
description: "Execute 5-phase workflow for complex features with token budgets, approval gates, and fast-track mode. TDD is opt-in via --tdd / MEOWKIT_TDD=1."
---
# meow:workflow-orchestrator
Execute 5-phase workflow for complex features with token budgets, approval gates, and fast-track mode. TDD is opt-in via `--tdd` / `MEOWKIT_TDD=1`.
## What This Skill Does
Orchestrates the full 5-phase development workflow: Understand+Design → Test (RED if `--tdd`) → Build → Refactor+Review → Finalize. Includes token budgets per phase (target ≤30K total), two approval gates, and a fast-track mode that skips Phase 1 when specs are pre-approved.
## Core Capabilities
- **5-phase pipeline** — Design → Test → Build → Refactor → Finalize
- **Two approval gates** — Phase 1 (Design) and Phase 3 (Build)
- **Token budgets** — Per-phase limits to prevent context explosion
- **Fast-track mode** — Skip Phase 1 for pre-approved specs
- **Auto-continue** — Phases 2, 4, 5 auto-continue unless blockers found
## Usage
```bash
/meow:cook [feature]              # standard 5-phase workflow
"fasttrack: [specs]"              # skip Phase 1
"workflow:start [task]"           # explicit invocation
```
::: info Skill Details
**Phase:** 0–5  
**Plan-First Gate:** Routes to plan-creator first. Skips in fasttrack mode.
:::

## Gotchas

- **Parallel agents editing same file**: Two subagents modify the same source file simultaneously → Define exclusive file ownership before spawning parallel agents
- **Token budget exceeded mid-workflow**: Complex 5-phase workflow runs out of context → Check remaining context at each phase boundary; escalate if < 20% remaining

## Related
- [`meow:cook`](/reference/skills/cook) — The user-facing entry point that triggers this
- [`meow:session-continuation`](/reference/skills/session-continuation) — Save/resume workflow state
