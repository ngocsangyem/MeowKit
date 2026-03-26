---
title: Code Review
description: Multi-pass code review with adversarial analysis.
persona: B
---

# Code Review

> Run a thorough multi-pass review with adversarial red-teaming.

**Best for:** Persona B  
**Time estimate:** 5-15 minutes  
**Skills used:** meow:review

## Step 1: Run the review

```
/meow:review                    # review current branch diff
/meow:review #42                # review PR #42
/meow:review --pending          # review uncommitted changes
/meow:review abc1234            # review specific commit
```

## Step 2: Review passes

The skill runs multiple passes:
1. **Scope drift detection** — compares diff against plan
2. **Two-pass checklist** — critical issues first, informational second
3. **Design review** — conditional on frontend files
4. **Test coverage audit** — traces codepaths, generates missing tests
5. **Adversarial review** — auto-scaled by diff size (cross-model red-teaming)

## Step 3: Verdict

- **APPROVE** — zero critical findings, proceed to ship
- **REQUEST CHANGES** — critical findings, must fix before shipping
- **BLOCK** — security vulnerability or spec violation

BLOCK verdict prevents `/meow:ship` from executing.
