---
name: meow:session-continuation
description: "Persists and restores mid-session workflow progress across context resets. Use when resuming workflows, saving state, or handling context compaction. Triggers on: handoff, save state, resume workflow."
model: haiku
triggers:
  - "handoff"
  - "save state"
  - "resume workflow"
  - "workflow:handoff"
  - "workflow:resume"
allowed-tools: Read, Write, Bash
source: aura-frog
---

<!-- Split for progressive disclosure (checklist #11, #14): 427 → ~60 lines -->

# Session Continuation

Manage workflow state across sessions with handoff and resume.

## When to Use

- Token count approaching 150K (75% of limit)
- User says "handoff", "save", "pause"
- User says "resume" + workflow ID
- Session ending with incomplete workflow
- Incomplete workflow from previous session

## Plan State Variables

```toon
state_vars[4]{var,purpose,persistence}:
  MEOWKIT_ACTIVE_PLAN,Current active plan path,Session temp file
  MEOWKIT_SUGGESTED_PLAN,Branch-matched plan hint,Inferred from git branch
  MEOWKIT_COMPLEXITY,Auto-detected task complexity,Session memory
  MEOWKIT_ACTIVE_AGENTS,Currently active agents,Session memory
```

## Process

1. **Detect trigger** — token limit, user command, or session ending
2. **If handoff** — load `references/handoff-flow.md`, execute save + summary
3. **If resume** — load `references/resume-and-state.md`, execute load + restore + continue
4. **If list** — show all saved workflows from `.claude/logs/workflows/`

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
