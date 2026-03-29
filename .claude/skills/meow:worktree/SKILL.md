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

Create an isolated worktree for a parallel agent.

```bash
git worktree add .worktrees/{agent-name} -b parallel/{agent-name}-{timestamp}
```

- Worktree path: `.worktrees/{agent-name}/`
- Branch: `parallel/{agent-name}-{timestamp}`
- Base: current feature branch HEAD

### merge

Merge a completed worktree branch back to the feature branch.

```bash
git checkout {feature-branch}
git merge parallel/{agent-name}-{timestamp} --no-ff -m "merge: parallel work from {agent-name}"
```

If merge conflicts occur:
1. List conflicting files
2. STOP and report to orchestrator
3. Do NOT auto-resolve — human or lead agent decides

### cleanup

Remove worktree and delete the parallel branch.

```bash
git worktree remove .worktrees/{agent-name}
git branch -d parallel/{agent-name}-{timestamp}
```

### list

Show active worktrees.

```bash
git worktree list
```

## Safety Rules

- NEVER create worktrees on `main` or `master` — only on feature branches
- ALWAYS cleanup worktrees after merge (don't leave stale worktrees)
- NEVER force-delete a worktree with uncommitted changes — commit or stash first
- Max 3 active worktrees at any time (enforced by parallel-execution-rules.md)

## Integration

Called by orchestrator when decomposing COMPLEX tasks into parallel subtasks.
Not invoked directly by users (orchestrator manages the lifecycle).
