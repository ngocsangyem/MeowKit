---
title: Shipping Code
description: The complete ship pipeline from tests to PR with adversarial review and issue linking.
persona: B
---

# Shipping Code

> Full ship pipeline: merge base → test → coverage → review → version bump → commit → PR.

**Best for:** Active developers  
**Time estimate:** 5-10 minutes  
**Skills used:** [meow:ship](/reference/skills/ship), [meow:review](/reference/skills/review), [meow:document-release](/reference/skills/document-release)  
**Agents involved:** shipper, reviewer, security (if auth-related), documenter

## Overview

`/meow:ship` is a 12-step automated pipeline. You run one command, and the next thing you see is a PR URL. It handles: merging the base branch, running tests, auditing coverage, reviewing code (with adversarial red-teaming), bumping version, generating changelog, linking GitHub issues, creating conventional commit, pushing, and creating the PR.

## Step-by-step guide

### Step 1: Ship

```bash
/meow:ship                      # auto-detect: feature/* → official, dev/* → beta
/meow:ship official              # explicitly target main/master
/meow:ship beta                  # target dev/beta (lighter pipeline)
/meow:ship --dry-run             # preview each step without executing
```

### Step 2: Watch the pipeline

Here's what each step does and which agent handles it:

| Step | Agent/Skill | What happens |
|------|------------|-------------|
| Pre-flight | shipper | Detects base branch, verifies feature branch, checks review dashboard |
| Merge base | shipper | `git fetch origin main && git merge origin/main` — auto-resolves lockfile conflicts |
| Run tests | tester (subagent) | Full test suite with failure triage (your fault vs pre-existing) |
| Coverage audit | meow:review (partial) | Traces codepaths, generates diagram, writes tests for gaps |
| Plan audit | meow:review (partial) | Cross-references plan items against diff — flags missing implementations |
| Pre-landing review | reviewer | Two-pass checklist: critical first, informational second |
| Adversarial review | meow:review | Auto-scaled by diff size (cross-model red-teaming) |
| Version bump | shipper | Auto-detects version file, bumps patch/minor. Beta: `1.2.4-beta.1` |
| Changelog | shipper | Auto-generates from `git log`, categorized: Added/Changed/Fixed/Removed |
| Issue linking | shipper | Searches GitHub issues by branch keywords, links in PR body |
| Commit + Push | shipper | Bisectable conventional commits → `git push -u origin feature/...` |
| PR creation | shipper | `gh pr create` with structured body, linked issues, rollback docs |
| Post-ship docs | documenter (meow:document-release) | Syncs README, ARCHITECTURE, CHANGELOG, TODOS |

### Step 3: See the result

```
✓ Pre-flight: branch feature/cart, 3 commits, +120/-15 lines (mode: official)
✓ Issues: linked #42, created #48
✓ Merged: origin/main (2 commits merged)
✓ Tests: 58 passed, 0 failed
✓ Coverage: 91% of new paths
✓ Review: 0 critical, 1 informational
✓ Adversarial: pass (medium tier, 120 lines)
✓ Version: 1.3.1 → 1.3.2
✓ Changelog: updated (1 Added, 1 Fixed)
✓ Committed: feat(cart): add shopping cart with quantity management
✓ Pushed: origin/feature/cart
✓ PR: https://github.com/org/repo/pull/45 (linked: #42, #48)
```

## Ship modes compared

| Mode | Target | Adversarial review | Version format | Docs update |
|------|--------|-------------------|---------------|-------------|
| `official` | main/master | Full (auto-scaled) | `1.2.3` | Yes |
| `beta` | dev/beta | Skipped | `1.2.3-beta.1` | Skipped |
| `--dry-run` | (preview) | (shows plan) | (shows prediction) | (shows what would update) |

## Common issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Pre-ship checks fail | Tests, lint, or types have errors | Back to developer — fix before re-shipping |
| Merge conflicts | Base branch diverged | Resolve conflicts manually, then re-run |
| CI fails on PR | Environment difference | Diagnose CI logs, fix, push again |
| No `gh` CLI | GitHub CLI not installed | Install `gh`, or push manually and create PR in browser |

## Next workflow

→ [Security Audit](/workflows/security-audit) — deep security assessment
