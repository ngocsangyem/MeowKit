---
title: "mk:task-queue"
description: "Task claiming and ownership tracking for parallel agent execution."
---

# mk:task-queue

Manages task assignment and file ownership during parallel execution. Agents claim tasks from a shared queue with file ownership enforcement.

## How it works

Tasks are tracked in `session-state/task-queue.json`:

- Each task has an owner, status, file ownership globs, and blocked_by list
- Agents claim tasks atomically — no two agents can claim the same task
- File ownership is enforced: agents cannot touch files outside their claim
- Blocked tasks wait for dependencies to complete

## Usage

Invoked automatically during parallel execution phases. Not typically called directly by users.

## Related

- `mk:team-config` — sets up worktrees and initializes the task queue
- `mk:spawn` — launches parallel agent sessions
