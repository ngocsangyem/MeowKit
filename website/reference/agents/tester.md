---
title: tester
description: "Test-writing agent. In TDD mode (--tdd / MEOWKIT_TDD=1), writes failing tests before implementation. In default mode, writes tests when invoked but does not block the developer."
---

# tester

Test-writing agent. In TDD mode (`--tdd` / `MEOWKIT_TDD=1`), writes failing tests before implementation (red phase) and verifies they pass after (green phase). In default mode (TDD off), writes tests when invoked but does not block the developer.

## Overview

The tester runs at two points: **Phase 2** (write tests) and **Phase 3** (verify tests pass after the developer finishes).

- **In TDD mode (`--tdd` / `MEOWKIT_TDD=1`):** The tester writes failing tests in Phase 2 before implementation begins. It does NOT greenlight the developer until tests demonstrably fail. This is strict TDD enforcement.
- **In default mode (TDD off, post-migration):** The tester writes tests when invoked by the orchestrator, developer, or user — but does not block. Tests may be written before, alongside, or after the implementation.

The tester owns all test files exclusively. In both modes, anti-rationalization rules apply: tests must fail for the *right reason* (functionality doesn't exist), no test minimization, no mock substitution for integration tests.

The tester owns all test files exclusively. It writes tests that fail for the *right reason* (functionality doesn't exist yet), not the wrong reason (syntax errors or missing imports).

## Quick Reference

### Development & Implementation

| Phase | What tester does | Deliverable |
|-------|-----------------|------------|
| **Test (Phase 2 — TDD mode)** | Write failing tests that define expected behavior | Test files that compile but fail |
| **Test (Phase 2 — default mode)** | Write tests on-request, no greenlight semantics | Test files (any pass/fail state) |
| **Verify (Phase 3)** | Verify developer's implementation passes all tests | Pass/fail report + coverage summary |
| **Refactor** | Suggest refactoring opportunities after green | Improvement suggestions |

### Test Ownership

The tester exclusively owns: `__tests__/`, `*.test.ts`, `*.spec.ts`, `tests/`, `*.test.js`, `*.spec.js`, `*.test.py`

### Quality Rules

- Tests must fail for the **right reason** (functionality missing, NOT syntax/import errors)
- Edge cases MUST be covered for critical paths (auth, payments, data validation)
- Tests must test **behavior**, not implementation details

## How to Use

The tester is invoked automatically by the orchestrator during Phases 2 and 3. You don't call it directly.

```
Phase 2 (after plan approved):
  Tester: "Writing tests for user authentication..."
  Tester: "Tests written and verified failing. Ready for implementation."
  → Handoff to developer

Phase 3 (after developer finishes):
  Tester: "Running all tests..."
  Tester: "42 passed, 0 failed. Coverage: 87%. All green."
  → Handoff to reviewer
```

## Under the Hood

### Handoff Example

**Red phase handoff:**
```
Tester → Developer:
  Files created: tests/auth.test.ts (12 tests, all failing)
  Reason for failure: auth module not yet implemented
  Edge cases covered: empty credentials, expired tokens, invalid format
  Ready for implementation: YES
```

**Green phase handoff:**
```
Tester → Reviewer:
  Test results: 42 passed, 0 failed
  New tests: 12 (from red phase)
  Regression: 0 (existing tests still pass)
  Coverage: 87% of new code paths
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tests fail for wrong reason (import error) | Missing dependency or wrong import path | Tester rewrites to fix compilation, keeps test logic |
| Developer can't make tests pass after 3 attempts | Test expectations may be wrong OR implementation approach flawed | Tester re-evaluates: "implementation bug" vs "test needs updating" |
| Test framework not configured | New project without test setup | Tester reports what's missing — doesn't attempt to install (escalates) |
| Not enough edge cases | Non-critical path | Tester prioritizes: auth/payments/data validation always get edge cases |
