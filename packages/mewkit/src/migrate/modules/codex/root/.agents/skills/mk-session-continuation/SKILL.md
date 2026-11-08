---
name: "mk-session-continuation"
description: "Persists and restores mid-session workflow progress across context resets. Use when resuming workflows, saving state, or handling context compaction. Triggers on: handoff, save state, resume workflow."
---

<!-- Split for progressive disclosure (checklist #11, #14): 427 → ~60 lines -->

# Session Continuation

Manage workflow state across sessions with handoff and resume.

## When to Use

- Runtime reports that the session is approaching its context-warning threshold
- User says "handoff", "save", "pause"
- User says "resume" + workflow ID
- Session ending with incomplete workflow
- Incomplete workflow from previous session

## Plan State

Saved workflow state lives in `.codex/logs/workflows/`; the active plan is resolved
from `session-state/active-plan.json` or by scanning `tasks/plans/`. Nothing is carried
between sessions in the environment.

## Process

1. **Detect trigger** — token limit, user command, or session ending
2. **If handoff** — load `references/handoff-flow.md`, execute save + summary
3. **If resume** — load `references/resume-and-state.md`, execute load + restore + continue
4. **If list** — show all saved workflows from `.codex/logs/workflows/`

## References

| Reference | When to load | Content |
|-----------|-------------|---------|
| **[handoff-flow.md](./references/handoff-flow.md)** | On handoff/save trigger | State save format, summary generation |
| **[resume-and-state.md](./references/resume-and-state.md)** | On resume trigger | Resume steps, state management, error handling, TOON format |

## Quick Commands

```
workflow:handoff           → Save state + get resume instructions
workflow:resume AUTH-123   → Load state + continue from last phase
workflow:list              → Show all saved workflows
```

## Gotchas

- **Stale handoff after codebase changes**: Saved state references files that were renamed or deleted → Validate all file paths in handoff state before resuming
- **TOON corruption on concurrent sessions**: Two agents writing state simultaneously → Use file locking or session-scoped state files