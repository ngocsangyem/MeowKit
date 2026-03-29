---
name: meow:team-config
description: >-
  Set up parallel agent team for COMPLEX tasks. Creates worktree structure,
  generates ownership map, and initializes task queue. Use when orchestrator
  decomposes a task into parallel subtasks, or when asked to "set up team",
  "parallel setup", or "configure worktrees".
argument-hint: '"task description" --agents N'
source: meowkit
allowed-tools:
  - Read
  - Glob
  - Bash
  - Write
---

# Team Configuration

Sets up the infrastructure for parallel agent execution. Called by orchestrator when a COMPLEX task is decomposed into independent subtasks.

## What It Does

1. **Analyzes the task** — identifies independent subtasks from the plan
2. **Generates ownership map** — assigns file ownership globs per subtask
3. **Creates worktrees** — one git worktree per parallel agent
4. **Initializes task queue** — `session-state/task-queue.json` with claiming protocol
5. **Validates no overlap** — checks ownership globs for conflicts before starting

## Setup Flow

```
Plan approved (Gate 1)
    ↓
Orchestrator identifies parallel opportunity
    ↓
meow:team-config
    ├── 1. Parse plan for independent subtasks
    ├── 2. Generate ownership map (which agent owns which files)
    ├── 3. Validate zero overlap between ownerships
    ├── 4. Create git worktrees via meow:worktree
    └── 5. Create task-queue.json via meow:task-queue
    ↓
Parallel agents start claiming tasks
```

## Ownership Map Template

See `templates/ownership-map-template.md` for the format agents use to declare file ownership.

## Constraints

- Max 3 parallel agents (from `parallel-execution-rules.md`)
- Only COMPLEX tasks qualify (orchestrator enforces this)
- Gates (1 and 2) are never parallelized
- All worktrees branch from current feature branch HEAD

## Gotchas

- **Overlapping ownership kills parallelism** — if two subtasks need the same file, they can't be parallel. Restructure the decomposition or handle the shared file in a sequential pre-step
- **Worktree naming with special characters** — skill names with `:` (e.g., `meow:review`) need quoting in shell paths
- **Stale worktrees from crashed sessions** — run `git worktree list` to check for orphaned worktrees before creating new ones
- **Integration test is mandatory** — after merging all worktrees, the full test suite MUST pass. Don't skip this

## Teardown

After all parallel agents complete and integration test passes:
1. Merge all worktree branches to feature branch
2. Remove worktrees via `meow:worktree cleanup`
3. Archive `session-state/task-queue.json`
