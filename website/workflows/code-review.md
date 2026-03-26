---
title: Code Review
description: Multi-pass code review with adversarial analysis, scope drift detection, and automated fixes.
persona: B
---

# Code Review

> Run a thorough multi-pass review with adversarial red-teaming.

**Best for:** Active developers  
**Time estimate:** 5-15 minutes  
**Skills used:** [meow:review](/reference/skills/review), [meow:cso](/reference/skills/cso) (if security concerns)  
**Agents involved:** reviewer, security (auto-inserts on auth/payments)

## Overview

MeowKit's review goes beyond "looks good to me." It runs 7 distinct passes, each looking for different issue categories, and includes cross-model adversarial red-teaming on larger diffs. Findings are classified as auto-fixable or requiring human decision.

## Step-by-step guide

### Step 1: Choose input mode

```bash
/meow:review                    # current branch diff (most common)
/meow:review #42                # specific PR
/meow:review --pending          # uncommitted changes
/meow:review abc1234            # specific commit
```

### Step 2: Watch the 7 passes execute

| Pass | What it checks | Blocks ship? |
|------|---------------|-------------|
| **Scope drift** | Diff vs plan file + TODOS.md — catch creep or missing requirements | If requirements missing |
| **Critical checklist** | SQL injection, race conditions, auth bypass, enum completeness | Yes (CRITICAL findings) |
| **Informational checklist** | Dead code, magic numbers, style, test gaps | No (noted in PR) |
| **Design review** | Component structure, accessibility (only if frontend files changed) | No |
| **Test coverage audit** | Traces codepaths, generates coverage diagram, writes missing tests | If coverage below gate |
| **Fix-first resolution** | Auto-fixes trivial issues (formatting, imports), asks about non-trivial | Depends on finding |
| **Adversarial review** | Cross-model red-team: "find ways this code breaks in production" | Only if CRITICAL security |

The adversarial review auto-scales:
- **<50 lines:** Skipped (small diff, low risk)
- **50-199 lines:** One cross-model adversarial pass
- **200+ lines:** Full battery (Claude structured + adversarial subagent)

### Step 3: Review the verdict

The **reviewer** agent produces a verdict file at `tasks/reviews/YYMMDD-name-verdict.md`:

```
Verdict: REQUEST CHANGES

Architecture Fit: PASS
Type Safety: PASS
Test Coverage: PASS
Security: REQUEST CHANGES — 1 critical finding
Performance: PASS WITH NOTE

Critical:
  1. [SECURITY] API key validation missing on /api/webhooks endpoint
     File: src/api/webhooks.ts:15
     Fix: Add auth middleware before handler

Informational:
  1. Consider caching webhook signature verification (performance)
```

### Step 4: Resolve findings

- **APPROVE** → proceed to `/meow:ship`
- **REQUEST CHANGES** → fix the critical findings, then re-review
- **BLOCK** → security vulnerability or spec violation; requires human resolution before anything else

### What happens when security auto-inserts

If your diff touches auth, payments, or user data, the **security** agent automatically joins the review:

```
Security agent (Phase 4):
  Platform: NestJS detected
  Checks: Auth guards ✓, Input validation ✓, Parameterized queries ✓
  Finding: Missing rate limiting on login endpoint (MEDIUM)
  Verdict: PASS (no CRITICAL findings)
```

A security BLOCK verdict halts the entire pipeline — only the security agent can clear it after re-audit.

## Next workflow

→ [Shipping Code](/workflows/ship-code) — ship after review passes
