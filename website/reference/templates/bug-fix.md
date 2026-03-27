# Bug Fix Template

> Use when fixing broken behavior.

**Primary agent:** investigator → developer → tester
**Workflow phases:** Phase 1 (Investigate) → Phase 2 (Test RED) → Phase 3 (Fix) → Phase 4 (Review)
**Create with:** `npx meowkit task new --type bug-fix "description"`

## When to use

- User-reported bug
- Failed test in CI
- Runtime error in production
- Unexpected behavior

## Key sections

### Bug Report
Captures: who reported, reproducibility, environment, frequency.

### Root Cause Analysis
Agent fills during investigation:
- **Hypothesis:** Initial theory before debugging
- **Confirmed cause:** After investigation
- **Why not caught:** What test gap allowed this

### Regression Risk
Lists what else might break — agent checks these areas after fix.
