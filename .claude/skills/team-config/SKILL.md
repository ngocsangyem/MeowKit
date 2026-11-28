---
name: mk:team-config
description: "Sets up a parallel agent team. NOT for mk:worktree."
argument-hint: '"task description"'
source: local
allowed-tools:
  - Read
  - Glob
  - Bash
  - Write
keywords:
  - team-config
  - worktree-setup
  - ownership-map
  - parallel-team-init
  - task-queue-init
when_to_use: "Auto-invoked on parallel subtasks."
user-invocable: false
owner: git
criticality: medium
status: active
runtime: claude-code
---

# Team Configuration

Sets up parallel agent execution when a COMPLEX task splits into independent subtasks. The lead (the main session) calls it; it is not user-invocable. For small, single-file or sequential work, do not use it: one agent is cheaper and faster.

## Setup Flow

1. **Decompose.** Find the independent subtasks in the agreed plan.
2. **Write the queue.** Create `.meowkit/state/task-queue.json` in the format owned by `mk:task-queue`, one task per agent with its `ownership` globs. That file is the ownership map.
3. **Check overlap.** Compare the globs yourself. If two tasks share a file, restructure the split or handle the shared file in a sequential pre-step; do not start overlapping agents.
4. **Create worktrees** via `mk:worktree`, one per agent, branched from the current feature branch HEAD.
5. **Start the agents.** Build each agent's brief with `mk:delegate` (goal, owned files, acceptance, return shape).

Limits (agent count, COMPLEX-only, zero overlap, no parallel planning or review, integration test) are owned by `.claude/skills/cook/references/parallel-execution-rules.md`; follow it rather than restating them here.
Each agent runs heavy builds and suites through `mewkit host run` per `.claude/skills/verify/references/heavy-commands.md` (beta).

## Team Coordination Rules

When team mode activates, read `references/team-coordination.md`: the team-only rules (ownership per task, no force-push, worktree-branch commits, actionable completion messages, lead docs-impact). They load only on team activation so single-session work pays nothing for them.

## Gotchas

- **Overlapping ownership kills parallelism**: two subtasks that need the same file cannot run in parallel.
- **Stale worktrees from crashed sessions**: run `git worktree list` for orphans before creating new ones.
- **Run the full test suite after merging all worktrees**: each worktree passed alone, so a failure here is the first sign of a conflict between them.

## Teardown

After the agents finish and the integration test passes, merge the worktree branches into the feature branch, remove the worktrees with `mk:worktree cleanup`, and archive `task-queue.json`.
