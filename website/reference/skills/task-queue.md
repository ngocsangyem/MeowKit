---
title: "mk:task-queue"
description: "Task claiming and ownership tracking for parallel agent execution — agents claim tasks from a shared queue with file ownership enforcement."
---

# mk:task-queue

## What This Skill Does

Manages task assignment and file ownership during parallel agent execution. Tracks tasks in `session-state/task-queue.json` with a claiming protocol that prevents file conflicts between agents.

## When to Use

- **Parallel execution phases** where multiple agents work simultaneously on different files
- **Automatically invoked** by `mk:team-config` when setting up parallel agent teams
- **NOT for:** single-agent tasks, sequential workflows, tasks without file ownership boundaries

## Core Capabilities

- **Task lifecycle:** pending → claimed → in_progress → completed (or blocked)
- **Claiming protocol:** lowest-ID task where status=pending AND all blocked_by tasks are completed
- **Ownership enforcement:** each task declares file globs; agents can only write to owned files; overlapping claims are rejected
- **Race condition prevention:** orchestrator is the sole claim serializer — agents request through it, never self-claim
- **Audit trail:** completed tasks remain in queue until the parallel phase ends

## Workflow

1. Orchestrator creates `session-state/task-queue.json` with tasks and ownership globs
2. Agent requests next available task from orchestrator
3. Orchestrator checks for ownership conflicts with other in_progress tasks
4. If no conflict: assigns task, sets status=in_progress, records owner
5. Agent completes task, sets status=completed
6. After all tasks complete, orchestrator runs integration test, then cleans up

## Usage

```bash
# Invoked automatically by mk:team-config during parallel setup
# Not typically called directly
```

## Example Prompt

```
Set up parallel task queue: 3 tasks — API endpoints (src/api/*), UI components (src/components/*), tests (tests/*). No overlapping ownership.
```

## Common Use Cases

- Parallel agent execution during harness builds
- Multi-file feature implementation with clear file boundaries
- Coordinated refactoring across independent modules

## Pro Tips

- **Ownership globs must not overlap.** `src/api/*` and `src/api/auth/*` overlap — the more specific glob must be in the same task.
- **Queue is ephemeral.** Lives in `session-state/`, cleared on new session. For persistent task tracking, use the plan's task system instead.
- **Agents never self-claim.** Always request through the orchestrator to prevent race conditions on parallel reads of `task-queue.json`.

> **Canonical source:** `.claude/skills/task-queue/SKILL.md`
