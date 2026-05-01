---
title: "mk:workflow-orchestrator"
description: "Auto-invoked orchestrator for the 7-phase workflow on complex-feature intent. Defers to mk:cook for single-task requests."
---
# mk:workflow-orchestrator
Auto-invoked orchestrator for the 7-phase workflow on complex-feature intent. Defers to `mk:cook` for single-task requests.
## What This Skill Does
Orchestrates the full 7-phase development workflow: Orient → Plan → Test → Build → Review → Ship → Reflect. Activates automatically via `autoInvoke` when Claude Code detects complex-feature intent at session start. Defers to `mk:cook` for explicit single-task invocations. Never runs concurrently with `mk:cook` in the same session.
## Core Capabilities
- **7-phase pipeline** — Orient → Plan → Test → Build → Review → Ship → Reflect
- **Two hard gates** — Gate 1 (plan approval) and Gate 2 (review approval)
- **Auto-invoke** — Activates on session start with complex-feature intent
- **Deference to mk:cook** — Explicit `/mk:cook` invocation takes priority
- **Phase routing** — Each phase delegates to the appropriate specialist agent
## Usage
```bash
/mk:cook [feature]              # standard 5-phase workflow
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
- [`mk:cook`](/reference/skills/cook) — The user-facing entry point that triggers this
- [`mk:session-continuation`](/reference/skills/session-continuation) — Save/resume workflow state
