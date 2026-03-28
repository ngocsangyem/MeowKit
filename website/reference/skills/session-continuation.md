---
title: "meow:session-continuation"
description: "Save and resume workflow state across sessions with handoff and TOON-based state persistence."
---
# meow:session-continuation
Save and resume workflow state across sessions with handoff and TOON-based state persistence.
## What This Skill Does
When a session approaches the context window limit (150K tokens, 75%), this skill saves the current workflow state (phase, agents, deliverables, key decisions) to a JSON file and generates a resume command. In a new session, `workflow:resume [id]` restores the full state and continues from where you left off.
## Core Capabilities
- **Auto-handoff** — Prompts at 75% context usage (150K tokens)
- **State persistence** — Saves to `.claude/logs/workflows/[id]/workflow-state.json`
- **Resume** — `workflow:resume [id]` restores state and continues
- **TOON format** — Token-efficient state format (73% smaller than JSON)
- **Auto-save** — Silent saves at phase completion and token milestones
## Usage
```bash
workflow:handoff            # save state + get resume command
workflow:resume AUTH-123    # restore and continue
workflow:list               # show all saved workflows
```
::: info Skill Details
**Phase:** 0–6
:::

## Gotchas

- **Stale handoff after codebase changes**: Saved state references files that were renamed or deleted → Validate all file paths in handoff state before resuming
- **TOON corruption on concurrent sessions**: Two agents writing state simultaneously → Use file locking or session-scoped state files

## Related
- [`meow:workflow-orchestrator`](/reference/skills/workflow-orchestrator) — The workflow being saved/resumed
