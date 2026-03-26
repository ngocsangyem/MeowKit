---
title: Fixing a Bug
description: Investigate, fix, and verify a bug with root cause analysis.
persona: B
---

# Fixing a Bug

> Structured bug investigation with root cause analysis, regression test, and verified fix.

**Best for:** Persona B (active developers)  
**Time estimate:** 10-30 minutes  
**Skills used:** meow:fix, meow:investigate, meow:review

## Step 1: Report the bug

```
/meow:fix login fails after 24 hours — session token not refreshed
```

## Step 2: Investigation (automatic)

MeowKit's investigate skill follows a 5-phase debugging methodology:
1. Collect symptoms
2. Read the code path
3. Check recent changes (`git log`)
4. Reproduce the issue
5. Form hypothesis: "Root cause: session refresh not called before expiry check"

## Step 3: TDD fix

- Writes a regression test that reproduces the bug
- Implements the minimal fix
- Verifies: test that was failing now passes, all other tests still pass

## Step 4: Ship the fix

If the fix is simple (≤3 files), Gate 1 is skipped. Gate 2 still applies.

## Next workflow

→ [Code Review](/workflows/code-review) — review someone else's changes
