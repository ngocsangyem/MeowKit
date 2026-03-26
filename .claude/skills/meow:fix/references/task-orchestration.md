# Task Orchestration

Tracking fix workflows with Claude Code task tools.

## When to Use Tasks

| Complexity | Use Tasks? | Reason |
|-----------|-----------|--------|
| Simple/Quick | No | < 3 steps, overhead exceeds benefit |
| Moderate (Standard) | Yes | 6 steps, multi-agent coordination |
| Complex (Deep) | Yes | 8 steps, dependency chains, parallel agents |
| Parallel | Yes | Multiple independent issue trees |

## Standard Workflow Tasks

Create all tasks upfront, then work through them:

```
T1 = TaskCreate(subject="Debug & investigate")
T2 = TaskCreate(subject="Scout related code")
T3 = TaskCreate(subject="Implement fix", addBlockedBy=[T1, T2])
T4 = TaskCreate(subject="Run tests", addBlockedBy=[T3])
T5 = TaskCreate(subject="Code review", addBlockedBy=[T4])
T6 = TaskCreate(subject="Finalize", addBlockedBy=[T5])
```

## Deep Workflow Tasks

Steps 1+2 run in parallel (debug + research simultaneously):

```
T1 = TaskCreate(subject="Debug & investigate")
T2 = TaskCreate(subject="Research solutions")
T3 = TaskCreate(subject="Brainstorm approaches", addBlockedBy=[T1, T2])
T4 = TaskCreate(subject="Create plan", addBlockedBy=[T3])
T5 = TaskCreate(subject="Implement fix", addBlockedBy=[T4])
T6 = TaskCreate(subject="Run tests", addBlockedBy=[T5])
T7 = TaskCreate(subject="Code review", addBlockedBy=[T6])
T8 = TaskCreate(subject="Finalize", addBlockedBy=[T7])
```

## Parallel Issue Coordination

For 2+ independent issues, create separate task trees:

```
// Issue A
T_A1 = TaskCreate(subject="[Issue A] Debug")
T_A2 = TaskCreate(subject="[Issue A] Fix", addBlockedBy=[T_A1])

// Issue B
T_B1 = TaskCreate(subject="[Issue B] Debug")
T_B2 = TaskCreate(subject="[Issue B] Fix", addBlockedBy=[T_B1])

// Shared final
T_final = TaskCreate(subject="Integration verify", addBlockedBy=[T_A2, T_B2])
```

## Rules

- Create tasks BEFORE starting work (upfront planning)
- Mark `in_progress` immediately when starting a task
- Mark `completed` immediately when finishing
- Skip tasks entirely for Quick workflow (< 3 steps)
