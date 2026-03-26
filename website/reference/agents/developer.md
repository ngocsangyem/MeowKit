---
title: developer
description: "Implementation agent that writes production code following approved plans with strict TDD and self-healing."
---

# developer

Implementation agent that writes production code following approved plans with strict TDD and self-healing.

## Overview

The developer writes production code in Phase 3 (Build GREEN). It reads the approved plan, confirms failing tests exist, then implements until all tests pass. The developer follows existing codebase patterns (no new patterns without an ADR), enforces type safety (no `any` types), and self-heals up to 3 times when tests fail — each attempt using a different approach. After 3 failures, it escalates.

The developer exclusively owns `src/`, `lib/`, `app/` — no other agent touches production code.

## Quick Reference

### Development & Implementation

| Rule | Enforcement |
|------|------------|
| **TDD strict** | Will not write code without failing tests from tester |
| **Plan required** | Reads `tasks/plans/YYMMDD-name.md` before starting |
| **No `any` types** | Type-safe code enforced (no `any`, no unsafe casts) |
| **Pattern respect** | Follows existing codebase patterns; new patterns need ADR |
| **Self-healing** | Up to 3 fix attempts with different approaches per failure |
| **Escalation** | After 3 failures: reports what was tried + suspected root cause |

### File Ownership

Exclusively owns: `src/`, `lib/`, `app/` directories (all production code).

## How to Use

The developer is invoked automatically after the tester confirms failing tests exist. You don't call it directly.

```
Developer receives:
  Plan: tasks/plans/260327-auth.md
  Failing tests: tests/auth.test.ts (12 tests, all red)

Developer works:
  "Reading plan... implementing auth middleware..."
  "Tests failing: 3 remaining... self-healing attempt 1..."
  "All 12 tests pass. Implementation complete."

Developer hands off:
  → Tester (green phase verify) → Reviewer
```

## Under the Hood

### Self-Healing Pattern

When tests fail after implementation:

```
Attempt 1: Fix based on test error message
Attempt 2: Different approach (alternative algorithm/pattern)
Attempt 3: Minimal implementation (simplest possible solution)
Escalation: Report failing output + what was tried + suspected root cause
```

Each attempt must use a **different approach** — not retry the same fix.

### Handoff Example

```
Developer → Tester (green verify):
  Files modified: src/middleware/auth.ts, src/services/token.ts
  Files created: src/utils/jwt-helper.ts
  Test results: 12/12 passing
  Plan deviations: None
  New patterns: None (used existing middleware pattern)
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "No failing tests found" | Tester hasn't run red phase | Wait for tester to complete Phase 2 |
| "No approved plan" | Gate 1 not passed | Approve the plan first |
| Self-healing exhausted (3 attempts) | Likely a plan/test mismatch | Escalated — check if plan needs revision or tests need updating |
| New pattern introduced without ADR | Developer shouldn't do this | Route to architect to evaluate and create ADR |
