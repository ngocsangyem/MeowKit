---
title: "mk:worktree"
description: "Git worktree management for parallel agent execution. Creates isolated worktrees for parallel agents, merges results, and cleans up."
---

# mk:worktree

## What This Skill Does

Worktree manages git worktrees to enable parallel agent execution. When the orchestrator decomposes a COMPLEX task into independent subtasks with zero file overlap, worktree creates an isolated worktree for each parallel agent, preventing file conflicts. After all agents complete, it merges results back to the feature branch, runs integration tests, and cleans up. It enforces safety constraints to prevent data loss.

## When to Use

Triggers:
- Called by the orchestrator when decomposing a COMPLEX task into parallel subtasks
- The orchestrator determines parallel execution is safe (zero file overlap, COMPLEX classification)

Anti-triggers:
- Direct invocation by users -- the orchestrator manages the lifecycle
- Simple or MODERATE tasks -- parallel execution only for COMPLEX tasks
- Tasks with file overlap -- overlapping files are handled sequentially

## Core Capabilities

- **Isolated worktree creation** -- branches from current feature HEAD into `.worktrees/{agent-name}/` on a `parallel/{agent-name}-{timestamp}` branch
- **No-fast-forward merge** -- merges completed worktree branches back to the feature branch with a merge commit
- **Conflict detection** -- if merge conflicts occur, lists conflicting files, stops, and reports; never auto-resolves
- **Integration test gate** -- after merge, runs the full test suite; if tests fail, the decomposition was wrong
- **Cleanup** -- removes worktree directories and deletes parallel branches after successful merge
- **Status listing** -- `list` shows all active worktrees and their branches
- **Safety enforcement** -- max 3 active worktrees, feature branches only, no force-delete with uncommitted changes

## Arguments

| Action | Effect |
|--------|--------|
| `create [agent-name]` | Create isolated worktree from current HEAD on `parallel/{agent-name}-{timestamp}` |
| `merge [agent-name]` | No-fast-forward merge of worktree branch back to feature branch |
| `cleanup [agent-name]` | Remove worktree directory and delete parallel branch (only after successful merge) |
| `list` | Show all active worktrees with branch names |

## Workflow

1. **Orchestrator decomposes** -- COMPLEX task split into independent subtasks with zero file overlap
2. **Create worktrees** -- one per parallel agent: `git worktree add .worktrees/{name} -b parallel/{name}-{timestamp}`
3. **Agents work in isolation** -- each agent edits only files in its worktree; no cross-worktree access
4. **Merge results** -- after all parallel agents complete, merge worktree branches to the feature branch
5. **Integration test** -- run full test suite on the merged result; if it fails, the decomposition was wrong
6. **Cleanup** -- remove worktree directories and parallel branches

## Usage

```bash
# Orchestrator creates worktrees for parallel agents
mk:worktree create agent-auth
mk:worktree create agent-db
mk:worktree create agent-api

# ...agents work independently in their worktrees...

# Orchestrator merges results
mk:worktree merge agent-auth
mk:worktree merge agent-db
mk:worktree merge agent-api

# Verify and cleanup
mk:worktree list
mk:worktree cleanup agent-auth
mk:worktree cleanup agent-db
mk:worktree cleanup agent-api
```

## Example Prompt

```
This is handled by the orchestrator internally -- users do not invoke mk:worktree directly.
```

## Common Use Cases

- Parallelizing a COMPLEX `mk:cook` task across 3 agents working on independent modules
- Running multiple code generation subtasks simultaneously without file conflicts
- Isolating experimental work from the main feature branch during exploration

## Pro Tips

- **Branch name collisions are prevented by timestamps.** The `{timestamp}` suffix ensures uniqueness.
- **Never create worktrees on `main` or `master`.** Only feature branches. The skill enforces this.
- **Worktrees share the same `.git`.** Force-pushing from a worktree affects the main checkout -- be careful.
- **macOS path quoting matters.** Worktree paths with `:` in names (derived from skill names like `mk:review`) need quoting in shell commands.
- **Integration test is mandatory.** If the test suite fails after merge, the parallel decomposition was wrong -- the subtasks had hidden dependencies.
- **Uncommitted changes block cleanup.** `git worktree remove` fails if there are uncommitted changes. Commit or stash first.

> **Canonical source:** `.claude/skills/worktree/SKILL.md`
