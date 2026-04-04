---
title: Fixing a Bug
description: Investigate, fix, and verify a bug with root cause analysis and regression testing.
persona: B
---

# Fixing a Bug

> Structured bug investigation with root cause analysis, regression test, and verified fix.

**Best for:** Active developers  
**Time estimate:** 10-30 minutes  
**Skills used:** [meow:fix](/reference/skills/fix), [meow:investigate](/reference/skills/investigate), [meow:scout](/reference/skills/scout), [meow:freeze](/reference/skills/freeze)

## Overview

Instead of immediately editing code when you report a bug, MeowKit forces a structured investigation: assess complexity, find the root cause, write a regression test, then apply the minimal fix. The skill adapts its approach based on bug complexity.

## Step-by-step guide

### Step 1: Report the bug

```
/meow:fix login fails after 24 hours — session token not refreshed
```

### Step 2: Complexity assessment

The [meow:fix](/reference/skills/fix) skill classifies the bug:

| Classification | Example | Pipeline |
|---------------|---------|---------|
| **Quick** | Typo, config error, lint failure | Direct fix → test → ship (Gate 1 skipped) |
| **Standard** | Logic bug in one module | Investigate → fix → test → review → ship |
| **Deep** | Cross-module race condition | Full investigation with parallel exploration |

Our example is **Standard** — logic bug in the auth module.

### Step 3: Investigation (meow:investigate)

The **developer** agent activates the [meow:investigate](/reference/skills/investigate) skill, which follows the Iron Law: **no fixes without root cause investigation first.**

```
Phase 1 — Collect symptoms:
  Error: 401 Unauthorized after 24h
  Stack trace: auth.middleware.ts:42 → token.service.ts:18

Phase 2 — Trace code path:
  → token.service.ts: refreshToken() exists but never called before expiry check
  → auth.middleware.ts: checks token.isExpired() but doesn't attempt refresh

Phase 3 — Check git history:
  git log --oneline -10 -- src/middleware/auth.ts
  → commit abc1234: "refactor: simplify auth middleware" — REMOVED refresh call

Root cause: "Commit abc1234 removed the token refresh call during refactoring.
The middleware checks expiry but no longer refreshes before the check."
```

### Step 4: Scope lock (meow:freeze)

The [meow:freeze](/reference/skills/freeze) skill locks edits to `src/middleware/` and `src/services/` — preventing accidental changes to unrelated code:

```
Debug scope locked to: src/middleware/, src/services/
Edits outside these directories are blocked for this session.
```

### Step 5: Regression test

The **tester** writes a test that reproduces the bug:

```typescript
// tests/auth-token-refresh.test.ts
test('should refresh token before expiry check', async () => {
  // Set token to expire in 1 second
  const token = createToken({ expiresIn: '1s' });
  await delay(1500); // Wait for expiry

  // This should succeed — middleware should refresh automatically
  const result = await authMiddleware.authenticate(token);
  expect(result.authenticated).toBe(true);
  expect(result.token).not.toBe(token); // New token issued
});
```

This test **fails** — confirming the bug exists.

### Step 6: Fix

The **developer** adds the refresh call back:

```typescript
// src/middleware/auth.ts — minimal fix
if (token.isExpired()) {
  token = await tokenService.refreshToken(token); // ← restored
}
```

Test now **passes**. All other tests still pass (no regressions).

### Step 7: Ship

Since this is a Standard bug fix, Gate 1 is skipped (the fix IS the plan). Gate 2 still applies:

```
✓ Review: PASS (minimal diff, regression test included)
✓ Commit: fix(auth): restore token refresh before expiry check
✓ PR: https://github.com/org/repo/pull/46 (Closes #42)
```

### Step 8: Journal (if escalation occurred)

If the developer's self-healing exhausted 3 attempts, the **journal-writer** documents what happened in `docs/journal/` with brutal honesty: what went wrong, what was tried, and how to prevent it next time.

## What MeowKit does automatically

| Concern | Agent/Hook | How it helps |
|---------|-----------|-------------|
| Root cause first | meow:investigate | Iron Law prevents fixing symptoms |
| Scope control | meow:freeze | Prevents touching unrelated code |
| Regression test | tester | Proves the bug existed AND the fix works |
| Security scan | post-write.sh | Checks every edited file for new vulnerabilities |
| Minimal diff | developer | Fixes root cause with fewest lines changed |
| Evidence-based | reviewer | Verifies fix with test output, not "should work" |

::: tip Jira Integration
After shipping the fix, update the bug ticket status:
```bash
/meow:jira transition BUG-123 Done --resolution Fixed
```
Future: meow:ship will do this automatically on merge.
:::

## Next workflow

→ [Code Review](/workflows/code-review) — review someone else's changes
