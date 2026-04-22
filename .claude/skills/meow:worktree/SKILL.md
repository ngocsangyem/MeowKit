---
name: meow:worktree
description: >-
  Git worktree management for parallel agent execution. Creates isolated worktrees
  for parallel agents, merges results, and cleans up. Use when orchestrator
  decomposes a COMPLEX task into parallel subtasks.
argument-hint: "[create|merge|cleanup] [agent-name]"
source: meowkit
---

# Git Worktree Manager

Manages git worktrees for parallel agent isolation. Each parallel agent works in its own worktree to prevent file conflicts.

## Actions

### create

Create an isolated worktree for a parallel agent. Branch from current feature branch HEAD into `.worktrees/{agent-name}/` on a `parallel/{agent-name}-{timestamp}` branch.

### merge

Merge a completed worktree branch back to the feature branch using a no-fast-forward merge.

If merge conflicts occur: list conflicting files, STOP, and report to orchestrator. Do NOT auto-resolve — human or lead agent decides.

After the full test suite passes on the merged result (per `parallel-execution-rules.md` Rule 5), delegate to `project-manager` per `.claude/rules/post-phase-delegation.md` Rule 1 (background — include "Run in the background" in the prompt) to summarize what each parallel branch contributed. Skipped when `MEOWKIT_PM_AUTO=off`.

### cleanup

Remove the worktree directory and delete the parallel branch after successful merge. Never cleanup a worktree with uncommitted changes — commit or stash first.

### list

Show all active worktrees to check parallel agent status.

## Gotchas

- Worktree creation fails if the branch name already exists — use timestamps to ensure uniqueness
- `git worktree remove` fails silently if the directory was already deleted manually — check existence first
- Worktrees share the same `.git` — force-pushing from a worktree affects the main checkout
- On macOS, worktree paths with `:` in skill names (e.g., `meow:review`) need quoting in shell commands

## Safety Rules

- NEVER create worktrees on `main` or `master` — only on feature branches
- ALWAYS cleanup worktrees after merge (don't leave stale worktrees)
- NEVER force-delete a worktree with uncommitted changes — commit or stash first
- Max 3 active worktrees at any time (enforced by parallel-execution-rules.md)

## Integration

Called by orchestrator when decomposing COMPLEX tasks into parallel subtasks.
Not invoked directly by users (orchestrator manages the lifecycle).
