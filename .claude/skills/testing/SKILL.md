---
name: mk:testing
description: "Writes and runs tests; TDD cycle. NOT for mk:nyquist."
keywords:
  - testing
  - unit-tests
  - tdd-red-green
  - validation-scripts
  - phase-2-test
when_to_use: "Tests to write or run."
user-invocable: true
owner: testing
criticality: medium
status: active
runtime: claude-code
---

# Testing Toolkit

Goal: write the tests a change needs, run them, and report. The deliverable is the tests added plus a pass/fail line with the command output. The references below are the how-to guides; load the one the step needs.

## When to Use

- During Phase 2 (Test) for writing tests — failing tests first in TDD mode (`--tdd` / `MEOWKIT_TDD=1`), or any-order tests in default mode
- During Phase 3 (Build) for verifying implementation
- When the `tester` agent needs testing patterns
- For visual QA testing of web applications
- Not here: mapping acceptance criteria to tests is `mk:nyquist`; a test-and-fix pass on a running site is `mk:qa`; flag precedence and the regression-test rule are in `.claude/skills/cook/references/tdd-rules.md`

## Workflow Integration

Operates in **Phase 2 (Test)** and **Phase 3 (Build)**. Output supports the `tester` agent.

In TDD mode the cycle is RED → GREEN → REFACTOR (failing tests required before implementation). In default mode (TDD off), tests may be written before, alongside, or after implementation — the developer chooses.

## References

| Reference | When to load | Content |
|-----------|-------------|---------|
| **[red-green-refactor.md](./references/red-green-refactor.md)** | Phase 2-3 | TDD cycle, test-first rules, refactoring guidelines |
| **[validation-scripts.md](./references/validation-scripts.md)** | After code changes | What the pattern-scan scripts do and when to run them |
| **[visual-qa.md](./references/visual-qa.md)** | UI testing | Browser-based visual QA, screenshot comparison, responsive testing |
| **[e2e-best-practices.md](./references/e2e-best-practices.md)** | When creating E2E tests | Tool preference, locator strategy, wait patterns, POM, flaky quarantine, success metrics |

## Gotchas

- **Mocks hiding integration failures**: All mocked tests pass but real service calls fail → Use integration tests for critical paths; mock third-party services only and use the real project dependencies elsewhere (this is the one mock rule; `mk:qa` follows it)
- **Test coverage metric gamed by trivial assertions**: 100% coverage with `expect(true).toBe(true)` → Measure mutation testing score alongside coverage; flag tests with zero assertions
