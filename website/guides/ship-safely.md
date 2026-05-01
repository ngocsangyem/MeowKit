---
title: Ship Safely
description: Deploy with /mk:ship — conventional commits, PR creation, CI verification, and rollback documentation.
---

# Ship Safely

`/mk:ship` handles deployment. It runs tests, creates conventional commits, opens a PR, and verifies CI — never pushes directly to main. It also documents rollback steps.

## Quick start

```bash
/mk:ship
```

MeowKit runs the full pre-ship checklist: test → lint → typecheck → commit → PR → CI verification. You review the PR and merge when CI passes.

## What happens

```
Phase 4 review approved (Gate 2)
  → pre-ship.sh: full test + lint + typecheck
  → git-manager: stage changes, conventional commit
  → shipper: push branch, create PR
  → Wait for CI
  → Document rollback steps
  → Merge when CI passes
```

## Flags

```bash
/mk:ship              # Standard ship pipeline
/mk:ship --canary     # Staged deployment with monitoring
/mk:ship --dry-run    # Preview without pushing or creating PR
```

## Commit format

Every ship produces a conventional commit:

```
feat(scope): description matching plan

Refs: #42
```

The scope and description come from the approved plan. No manual commit message needed.

## Safety rules

- **Never pushes to main directly.** Always creates a PR.
- **CI must pass before merging.** The shipper verifies CI status.
- **Rollback docs required.** Every ship documents how to revert.
- **Pre-ship hook runs first.** `pre-ship.sh` blocks the ship if tests, lint, or typecheck fail.

## Hotfix exception

```bash
/mk:fix "critical payment bug" --quick
# After fix verified:
/mk:ship  # Hotfix: requires human approval but skips some checks
```

Hotfixes still require Gate 2 approval but may skip non-critical checks. Document the reason in the PR description.

## Memory capture

Before shipping, capture non-obvious decisions and corrections:

```
##decision: Used connection pool over per-request connection — load testing showed 3x throughput
##pattern:bug-class Race condition in payment retry — fixed with idempotency key
```

These persist to `.claude/memory/` for future sessions.

## Don't use /mk:ship for

- **Features still in development** — complete the review pipeline first
- **Experimental code** — ship only reviewed, tested code
- **Force pushes** — MeowKit never force-pushes

## Next steps

- [Build a feature](/guides/build-a-feature) — the full pipeline ending with ship
- [Review code](/guides/review-code) — the review phase before shipping
- [Gates & security](/core-concepts/gates) — how Gate 2 protects shipping
