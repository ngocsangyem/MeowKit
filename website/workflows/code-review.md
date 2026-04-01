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

MeowKit's review goes beyond "looks good to me." It uses a scope-aware hybrid system: 3 base reviewers (Phase A) + up to 4 adversarial persona passes (Phase B) + forced-finding protocol + 4-level artifact verification. Findings are classified as auto-fixable or requiring human decision.

## Step-by-step guide

### Step 1: Choose input mode

```bash
/meow:review                    # current branch diff (most common)
/meow:review #42                # specific PR
/meow:review --pending          # uncommitted changes
/meow:review abc1234            # specific commit
```

### Step 2: Watch the review pipeline execute

**Step 1 — Scope Gate:** Classifies diff as `minimal` or `full` based on file count, line count, security files, and domain complexity.

| Phase | What it does | Scope |
|-------|-------------|-------|
| **Phase A: Base Reviewers** | 3 parallel reviewers — Blind Hunter, Edge Case Hunter, Criteria Auditor | All scopes (minimal = Blind Hunter only) |
| **Phase B: Adversarial Personas** | 4 hostile-lens passes informed by Phase A findings — Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope Critic | Full scope only (2 personas for standard, 4 for high-domain) |
| **Forced-Finding** | If zero findings → re-analyze once with "look harder" prompt | All scopes |
| **Artifact Verification** | 4-level check: Exists, Substantive, Wired, Data Flowing | Full scope only |
| **Triage** | Categorize as current-change (blocks ship) vs incidental (backlog) | All scopes |

**Scope auto-scales:**
- **Minimal** (≤3 files, ≤50 lines, no security, domain≠high): Blind Hunter only — fast, low noise
- **Full** (anything above thresholds): All 3 reviewers + personas + artifact verification

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
