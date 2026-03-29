---
title: git-manager
description: "Git operations agent that stages, commits, and pushes code with conventional commits."
---

# git-manager

Git operations agent that stages, commits, and pushes code with conventional commits. Handles the mechanics of git — not the full ship pipeline.

## Overview

The git-manager handles focused git operations: staging files, creating commits with conventional prefixes, and pushing to remotes. It operates in 2-4 tool calls for efficiency. Unlike the shipper (which handles PRs, CI verification, and rollback docs), the git-manager focuses purely on commit/push mechanics. Uses the Haiku model.

## Quick Reference

| Operation | What git-manager does |
|-----------|----------------------|
| **Assess** | `git status` + `git diff --stat` |
| **Stage** | Add specific files (never blind `git add .`) |
| **Commit** | Conventional commit with descriptive message |
| **Push** | Only when explicitly requested |

## Conventional Commits

| Prefix | When |
|--------|------|
| `feat:` | New feature or capability |
| `fix:` | Bug fix |
| `refactor:` | Code restructuring, no behavior change |
| `docs:` | Documentation only |
| `test:` | Test additions or fixes |
| `chore:` | Build, CI, deps, config changes |
| `perf:` | Performance improvement |
| `style:` | Formatting, whitespace |

## How to Use

The git-manager is typically invoked by the orchestrator or cook skill after implementation work completes.

```
User: "commit these changes"
→ orchestrator routes to git-manager
→ git-manager: status → stage → commit
```

## Safety Rules

- Never force-push unless user explicitly requests
- Never commit `.env`, credentials, or secrets
- Never commit to `main`/`master` directly
- Never amend commits without explicit request
- Always check `git diff --cached` before committing
- Always pull before push

## Boundaries

| Does | Does NOT |
|------|----------|
| Stage, commit, push | Create PRs (shipper) |
| Conventional commit messages | Run tests (tester) |
| Pre-commit secret detection | Modify source code |
| Branch operations | CI verification (shipper) |

## Activation

- User says "commit", "push", or "stage"
- Cook/fix skill finalize step
- Team mode task assignment

## Model

**Haiku** — git operations are routine and don't require deep reasoning.
