---
title: "meow:worktree"
description: "Git worktree management for parallel agent execution. Creates isolated worktrees per agent, merges results, and cleans up after parallel tasks complete."
---

# meow:worktree

Git worktree management for parallel agent execution. Each parallel agent works in its own worktree to prevent file conflicts.

## What This Skill Does

When the orchestrator decomposes a COMPLEX task into parallel subtasks, meow:worktree creates an isolated git worktree for each parallel agent, manages the lifecycle (create → work → merge → cleanup), and enforces safety constraints to prevent data loss. Agents in separate worktrees cannot accidentally overwrite each other's work.

## When to Use

::: tip For COMPLEX parallel tasks
meow:worktree is used by the orchestrator when decomposing COMPLEX tasks into independent parallel subtasks. You do not invoke it directly in most cases.

Parallel execution only qualifies when subtasks have zero file overlap and the task is classified as COMPLEX.
:::

## Actions

| Action | What it does |
|--------|-------------|
| `create [agent-name]` | Branch from current HEAD into `.worktrees/{agent-name}/` on a `parallel/{agent-name}-{timestamp}` branch |
| `merge [agent-name]` | Merge completed worktree branch back to feature branch (no-fast-forward) |
| `cleanup [agent-name]` | Remove worktree directory and delete the parallel branch after successful merge |
| `list` | Show all active worktrees to check parallel agent status |

## How It Works

1. **Orchestrator decomposes** — COMPLEX task split into independent subtasks with zero file overlap
2. **Create worktrees** — one per parallel agent: `git worktree add .worktrees/{name} -b parallel/{name}-{timestamp}`
3. **Agents work in isolation** — each agent edits only files in its worktree; no cross-worktree access
4. **Merge results** — after all parallel agents complete, merge worktree branches to feature branch
5. **Integration test** — run full test suite on merged result; if it fails, the decomposition was wrong
6. **Cleanup** — remove worktree directories and parallel branches

## Constraints

- **Max 3 active worktrees** at any time — enforced by `parallel-execution-rules.md`
- **Feature branches only** — never create worktrees on `main` or `master`
- **No force-delete** with uncommitted changes — commit or stash first
- **Merge conflicts** — if conflicts occur during merge, list conflicting files, STOP, and report to orchestrator; do NOT auto-resolve
- **Integration test required** — after merge, always run full test suite before proceeding

## Gotchas

- **Branch name collision** — worktree creation fails if branch already exists; timestamps ensure uniqueness
- **Manual directory deletion** — `git worktree remove` fails silently if directory was already deleted; check existence first
- **Shared `.git`** — worktrees share the same `.git` directory; force-pushing from a worktree affects the main checkout
- **macOS path quoting** — worktree paths with `:` in skill names (e.g., `meow:review`) need quoting in shell commands
- **Staged parallel mode** — when strict zero-overlap is impractical, overlapping files are handled sequentially while non-overlapping work runs in parallel; see `parallel-execution-rules.md`

## Related

- [meow:task-queue](/reference/skills/workflow-orchestrator) — task claiming and ownership enforcement for parallel agents
- [meow:cook](/reference/skills/cook) — pipeline skill that triggers parallel execution for COMPLEX tasks
- Parallel execution rules: `.claude/rules/parallel-execution-rules.md`
