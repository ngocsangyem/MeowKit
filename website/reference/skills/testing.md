---
title: "mk:testing"
description: "Test writing toolkit — TDD red-green-refactor, validation scripts, visual QA, E2E best practices."
---

# mk:testing

Reference toolkit for testing: TDD red-green-refactor cycle, validation scripts, visual QA, and E2E best practices. Used by the `tester` agent in Phase 2-3.

## When to use

- Phase 2 (Test): writing tests — failing tests first in TDD mode (`--tdd`), any order in default mode
- Phase 3 (Build): verifying implementation

## TDD cycle

In TDD mode: RED (write failing test) → GREEN (implement until passes) → REFACTOR (improve without breaking). In default mode: tests may be written before, alongside, or after implementation — developer chooses.

## References (loaded on-demand)

| Reference | When | Content |
|---|---|---|
| `red-green-refactor.md` | Phase 2-3 | TDD cycle, test-first rules, refactoring |
| `validation-scripts.md` | After code changes | Running validation, interpreting results |
| `visual-qa.md` | UI testing | Browser-based visual QA, screenshots, responsive |
| `e2e-best-practices.md` | Creating E2E tests | Tool preference, locator strategy, wait patterns, POM, flaky quarantine |

## Gotchas

- **Mocks hiding integration failures:** all mocked tests pass but real calls fail → use integration tests for critical paths; mock only external third-party services
- **Coverage gamed by trivial assertions:** 100% with `expect(true).toBe(true)` → measure mutation testing alongside coverage; flag tests with zero assertions
