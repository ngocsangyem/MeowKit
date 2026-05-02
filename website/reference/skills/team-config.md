---
title: "mk:team-config"
description: "Set up parallel agent team for COMPLEX tasks — creates worktree structure, generates ownership map, initializes task queue."
---

# mk:team-config

## What This Skill Does

Sets up the infrastructure for parallel agent execution. Called by the orchestrator when a COMPLEX task is decomposed into independent subtasks. Creates isolated git worktrees, assigns file ownership globs per agent, and initializes the task queue.

## When to Use

- **COMPLEX tasks only** (orchestrator enforces this)
- When a plan identifies independent subtasks that can run in parallel
- **Max 3 parallel agents** (from `parallel-execution-rules.md`)
- **NOT for:** sequential tasks, tasks sharing the same files, gate phases (never parallelized)

## Core Capabilities

- **Subtask decomposition:** parses the approved plan to identify independent subtasks
- **Ownership map:** assigns file ownership globs per subtask, validates zero overlap
- **Worktree creation:** creates one git worktree per parallel agent via `mk:worktree`
- **Task queue init:** creates `session-state/task-queue.json` with claiming protocol via `mk:task-queue`
- **Validation:** checks for overlapping ownership before dispatching agents

## Workflow

```
Plan approved (Gate 1)
    ↓
Orchestrator identifies parallel opportunity
    ↓
mk:team-config
    ├── 1. Parse plan for independent subtasks
    ├── 2. Generate ownership map
    ├── 3. Validate zero overlap between ownerships
    ├── 4. Create git worktrees via mk:worktree
    └── 5. Create task-queue.json via mk:task-queue
    ↓
Parallel agents start claiming tasks
```

## Usage

```bash
# Invoked automatically by orchestrator for COMPLEX tasks
# Not typically called directly
/mk:team-config "build user dashboard with auth and analytics" --agents 3
```

## Example Prompt

```
Decompose the approved plan for the payment module: 1) API endpoints (src/api/payments/*), 2) UI forms (src/components/payments/*), 3) Integration tests (tests/payments/*). Set up parallel agents with zero file overlap.
```

## Common Use Cases

- Harness-driven parallel builds with independent modules
- Multi-service feature implementation (backend + frontend + tests)
- Coordinated refactoring across non-overlapping code areas

## Pro Tips

- **Overlapping ownership kills parallelism.** If two subtasks need the same file, restructure or handle the shared file sequentially first.
- **Integration test is mandatory.** After merging all worktrees, the full test suite must pass. Never skip this.
- **Check for stale worktrees.** Run `git worktree list` before creating new ones to catch orphaned worktrees from crashed sessions.
- **Gates are never parallelized.** Gate 1 and Gate 2 always run sequentially — parallel mode applies only to Phase 3 (Build).

> **Canonical source:** `.claude/skills/team-config/SKILL.md`
