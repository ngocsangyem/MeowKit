---
title: shipper
description: "Deployment pipeline agent that executes the full ship sequence from pre-checks to PR with rollback documentation."
---

# shipper

Deployment pipeline agent that executes the full ship sequence from pre-checks to PR with rollback documentation.

## Overview

The shipper handles Phase 5: getting code from "reviewed and approved" to "PR created and CI passing." It runs pre-ship checks (tests + lint + typecheck), creates conventional commits, pushes to a feature branch, creates a PR via `gh`, and verifies CI passes. Every ship includes rollback documentation. It uses the Haiku model since shipping is routine work.

## Quick Reference

### Documentation & Management

| Step | What shipper does |
|------|------------------|
| **Pre-ship checks** | Run test suite, linter, type checker — ALL must pass |
| **Conventional commit** | `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:` |
| **Branch + PR** | Feature branch, never commit to main directly |
| **CI verification** | Verify CI passes on the PR |
| **Rollback docs** | Every ship includes rollback procedure |

## How to Use

```bash
/meow:ship                # auto-detect mode
/meow:ship official       # ship to main
/meow:ship beta           # ship to dev branch
```

## Under the Hood

### Handoff Example

```
Shipper receives from reviewer:
  Verdict: PASS
  Files changed: 5
  Branch: feature/auth-jwt

Shipper executes:
  ✓ Pre-ship: tests pass, lint clean, types clean
  ✓ Commit: feat(auth): add JWT authentication flow
  ✓ Push: origin/feature/auth-jwt
  ✓ PR: https://github.com/org/repo/pull/42
  ✓ CI: passing
  ✓ Rollback: documented in PR description

  → Handoff to documenter (Phase 6)
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Pre-ship checks fail | Tests, lint, or types have errors | Back to developer/tester to fix |
| CI fails on PR | Different environment | Report CI failure details — don't retry, diagnose |
| Can't create PR | No `gh` CLI or auth failure | Create commit/branch locally, ask user to push |
| Force push attempted | Never allowed | Shipper only uses regular `git push` |
