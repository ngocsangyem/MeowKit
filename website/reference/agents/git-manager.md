---
title: git-manager
description: Git operations agent — stages, commits, and pushes with conventional commit format. Does NOT create PRs.
---

# git-manager

Handles git operations: stage, commit, push. Uses conventional commits. Does NOT create PRs or run CI — that's the shipper's job. Runs on Haiku tier.

## Key facts

| | |
|---|---|
| **Type** | Support |
| **Phase** | 5, any |
| **Subagent type** | utility |
| **Auto-activates** | On "commit" or "push" requests |
| **Never does** | Force push, push to main directly, `git add .` blindly (checks for secrets first), create PRs |

## Workflow

1. Assess — `git status` + `git diff --stat`
2. Stage — specific files only, never `git add .` blindly
3. Commit — conventional commit with descriptive message
4. Push — only if explicitly requested

## Commit format

```
<type>(<optional scope>): <short description>
```

| Prefix | When |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code restructuring, no behavior change |
| `docs:` | Documentation only |
| `test:` | Test additions/fixes |
| `chore:` | Build, CI, deps, config |
| `perf:` | Performance improvement |
