# Task Orchestration

Tracking fix workflows with the host runtime's tracked-task capability, when available (an
interface — not a specific tool name; fall back to a plain to-do list or the plan file itself
when unavailable).

## When to Use Tasks

| Complexity | Use Tasks? | Reason |
|-----------|-----------|--------|
| Simple/Quick | No | < 3 steps, overhead exceeds benefit |
| Moderate (Standard) | Yes | 6 steps, multi-agent coordination |
| Complex (Deep) | Yes | 8 steps, dependency chains, parallel agents |
| Parallel | Yes | Multiple independent issue trees |

## Standard Workflow Tasks

Create all tasks upfront, then work through them in dependency order:

1. Debug & investigate
2. Scout related code
3. Implement fix (blocked by 1, 2)
4. Run tests (blocked by 3)
5. Code review (blocked by 4)
6. Finalize (blocked by 5)

## Deep Workflow Tasks

Steps 1+2 run in parallel (debug + research simultaneously):

1. Debug & investigate
2. Research solutions
3. Brainstorm approaches (blocked by 1, 2)
4. Create plan (blocked by 3)
5. Implement fix (blocked by 4)
6. Run tests (blocked by 5)
7. Code review (blocked by 6)
8. Finalize (blocked by 7)

## Parallel Issue Coordination

For 2+ independent issues, create separate task trees that converge on a shared final task:

- Issue A: 1) Debug → 2) Fix (blocked by 1)
- Issue B: 1) Debug → 2) Fix (blocked by 1)
- Shared final: Integration verify (blocked by both issues' Fix tasks)

## Rules

- Create tasks BEFORE starting work (upfront planning)
- Mark `in_progress` immediately when starting a task
- Mark `completed` immediately when finishing
- Skip tasks entirely for Quick workflow (< 3 steps)
