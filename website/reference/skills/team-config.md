---
title: "mk:team-config"
description: "Set up parallel agent team — creates worktrees, ownership maps, and task queue for COMPLEX tasks."
---

# mk:team-config

Sets up infrastructure for parallel agent execution. Called by the orchestrator when a COMPLEX task is decomposed into independent subtasks.

## What it does

1. Analyzes the task — identifies independent subtasks from the plan
2. Generates ownership map — assigns file ownership globs per subtask
3. Creates worktrees — one git worktree per parallel agent
4. Initializes task queue — `session-state/task-queue.json`
5. Validates no overlap — checks ownership globs for conflicts

## Usage

```bash
/mk:team-config "implement checkout system" --agents 3
```

Invoked by the orchestrator during parallel execution setup. Not typically called directly.

## Related

- `mk:task-queue` — manages task claiming and ownership
- `mk:spawn` — launches parallel agent sessions
