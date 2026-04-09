---
title: developer
description: "Implementation agent that writes production code following approved plans. TDD is opt-in via --tdd / MEOWKIT_TDD=1."
---

# developer

Implementation agent that writes production code following approved plans. TDD is opt-in via `--tdd` / `MEOWKIT_TDD=1`: when enabled, never writes code until failing tests exist; when disabled (default), implements directly per the approved plan.

## Overview

The developer writes production code in Phase 3 (Build). It reads the approved plan and implements per acceptance criteria. **In TDD mode** (`--tdd` / `MEOWKIT_TDD=1`), it confirms failing tests exist first, then implements until all tests pass. **In default mode** (TDD off), it proceeds directly to implementation; tests are recommended but not gated. The developer follows existing codebase patterns (no new patterns without an ADR), enforces type safety (no `any` types), and self-heals up to 3 times when tests fail — each attempt using a different approach. After 3 failures, it escalates.

The developer exclusively owns `src/`, `lib/`, `app/` — no other agent touches production code.

## Quick Reference

### Development & Implementation

| Rule | Enforcement |
|------|------------|
| **TDD opt-in** | In TDD mode (`--tdd` / `MEOWKIT_TDD=1`): will not write code without failing tests from tester. Default mode: implements directly per plan. |
| **Plan required** | Reads `tasks/plans/YYMMDD-name.md` before starting |
| **No `any` types** | Type-safe code enforced (no `any`, no unsafe casts) |
| **Pattern respect** | Follows existing codebase patterns; new patterns need ADR |
| **Self-healing** | Up to 3 fix attempts with different approaches per failure |
| **Escalation** | After 3 failures: reports what was tried + suspected root cause |

### File Ownership

Exclusively owns: `src/`, `lib/`, `app/` directories (all production code).

## How to Use

The developer is invoked automatically after the tester confirms failing tests exist (in TDD mode) or directly after the planner (in default mode). You don't call it directly.

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

## Bead Processing

For COMPLEX tasks, the developer processes the plan's bead decomposition sequentially. Each bead is committed independently, making large builds resumable and reviewable in smaller increments.

### Processing loop

```
for each bead in plan:
  1. Read bead definition (files + acceptance check)
  2. Implement until bead's tests pass
  3. Type-check passes
  4. Commit: "feat(bead-NN): <bead description>"
  5. Mark bead complete in plan file
  6. Move to next bead
```

### Progress tracking

The developer updates the plan file as beads complete:

```markdown
- [x] bead-01: auth middleware (committed: abc1234)
- [x] bead-02: token service (committed: def5678)
- [ ] bead-03: refresh endpoint  ← current
- [ ] bead-04: integration tests
```

### Resume on interruption

If the session is interrupted mid-task, the developer reads the plan file to find the last uncommitted bead and resumes from there. No work is duplicated or lost.

### Commit per bead

Each bead produces exactly one conventional commit. Bead commits use the format:

```
feat(bead-NN): <description matching plan>
```

This keeps git history granular and makes partial-build rollback straightforward.

### When beads apply

Bead processing activates when the plan file contains a bead section (COMPLEX tasks, 5+ files). For standard plans, the developer follows the normal sequential implementation without bead commits.

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
