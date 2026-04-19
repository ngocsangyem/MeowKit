---
title: "meow:ship"
description: "Automated ship pipeline with official/beta modes, adversarial review, issue linking, and PR creation."
---

# meow:ship

Automated ship pipeline with official/beta modes, adversarial review, issue linking, and PR creation.

## What This Skill Does

`meow:ship` takes your feature branch from "code complete" to "PR created with CI passing" in one command. It runs a 12-step pipeline: merge the base branch, run tests, audit coverage, review code (including adversarial red-teaming), bump the version, generate changelog, link GitHub issues, create a conventional commit, push, and create a PR. The entire pipeline is non-interactive — it only stops for test failures, critical review issues, or major version decisions.

## Core Capabilities

- **Ship mode detection** — `official` targets main/master, `beta` targets dev/beta, auto-detected from branch name
- **Full test + coverage audit** — Runs all tests, triages in-branch vs pre-existing failures, generates coverage diagram, writes missing tests
- **Auto-scaled adversarial review (Claude-only)** — Small diffs skip adversarial; medium diffs get a Claude adversarial subagent pass; large diffs run Claude structured + Claude adversarial subagent (2 passes)
- **Issue linking** — Searches GitHub for related issues by branch keywords, creates tracking issues if none found
- **Version bump + changelog** — Auto-detects version file, bumps appropriately, generates categorized changelog
- **PR creation with edit support** — Creates PR via `gh`, or edits existing PR if one already exists
- **Dry-run mode** — `--dry-run` previews what each step would do without executing

## When to Use This

::: tip Use meow:ship when...
- Code is complete, reviewed, and ready to merge
- You want the full ship pipeline in one command
- You need to ship to main (official) or dev (beta) branch
- You want to preview the ship with `--dry-run` before executing
:::

::: warning Don't use meow:ship when...
- Code isn't ready — run tests and review first
- You just want a code review → use [`meow:review`](/reference/skills/review)
- You're on the target branch already — ship from a feature branch
:::

## Usage

```bash
# Auto-detect mode from branch name
/meow:ship

# Explicit: ship to main/master
/meow:ship official

# Ship to dev/beta branch (lighter pipeline)
/meow:ship beta

# Skip tests (when tests already passed this session)
/meow:ship --skip-tests

# Preview without executing
/meow:ship --dry-run
```

## Example Prompts

| Prompt | Mode | Target |
|--------|------|--------|
| `/meow:ship` | Auto (from branch name) | main if `feature/*`, dev if `dev/*` |
| `/meow:ship official` | Official | main/master |
| `/meow:ship beta` | Beta | dev/beta/develop |
| `/meow:ship --dry-run` | Preview | Shows plan without executing |

## Quick Workflow

```
/meow:ship
  ↓
Pre-flight → Merge base → Tests → Coverage audit
  → Plan audit → Pre-landing review → Adversarial review
  → Version bump → Changelog → Issue linking
  → Commit → Push → PR creation
  ↓
✓ PR: https://github.com/org/repo/pull/123
```

Output summary after completion:

```
✓ Pre-flight: branch feature/auth, 5 commits, +200/-50 lines (mode: official)
✓ Issues: linked #42, created #43
✓ Tests: 42 passed, 0 failed
✓ Review: 0 critical, 2 informational
✓ Version: 1.2.3 → 1.2.4
✓ PR: https://github.com/org/repo/pull/123 (linked: #42, #43)
```

::: info Skill Details
**Phase:** 5  
**Used by:** shipper agent  
**Plan-First Gate:** Requires approved plan. Skips for hotfix with human approval.
:::

## Gotchas

- **Version bump conflicts in monorepo**: Multiple packages bump the same version file → Use per-package VERSION files; bump only the package being shipped
- **CI passing locally but failing remotely**: Local env has different Node version or env vars → Always verify CI status after push; don't merge on local-only results
- **Adversarial review is Claude-only**: Large-diff reviews run 2 passes (Claude structured + Claude adversarial subagent). No cross-model review is invoked.
- **Inline lite design check runs only on frontend diffs**: The pre-landing review block calls `meowkit-diff-scope`. If `SCOPE_FRONTEND=false` the design check skips silently. If true, it reads [`meow:review/design-checklist.md`](/reference/skills/review) and applies the 6-category pattern scan. Findings join the Fix-First flow (AUTO-FIX vs ASK vs visual-only).

## Related

- [`meow:review`](/reference/skills/review) — The review pass run during ship
- [`meow:cook`](/reference/skills/cook) — Includes ship as the final phase
- [`meow:qa-manual`](/reference/skills/qa-manual) — QA testing before shipping
