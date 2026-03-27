---
name: meow:testing
description: "Use when writing tests, running validation scripts, or enforcing red-green-refactor cycle. Activates during Phase 2 (Test RED) and Phase 3 (Build GREEN)."
---

# Testing Toolkit

Reference guides for testing: TDD red-green-refactor, validation scripts, and visual QA.

## When to Use

- During Phase 2 (Test RED) for writing failing tests first
- During Phase 3 (Build GREEN) for verifying implementation
- When the `tester` agent needs testing patterns
- For visual QA testing of web applications

## Workflow Integration

Operates in **Phase 2 (Test RED)** and **Phase 3 (Build GREEN)**. Output supports the `tester` agent.

## References

| Reference | When to load | Content |
|-----------|-------------|---------|
| **[red-green-refactor.md](./references/red-green-refactor.md)** | Phase 2-3 | TDD cycle, test-first rules, refactoring guidelines |
| **[validation-scripts.md](./references/validation-scripts.md)** | After code changes | Running validation scripts, interpreting results |
| **[visual-qa.md](./references/visual-qa.md)** | UI testing | Browser-based visual QA, screenshot comparison, responsive testing |

## Gotchas

- **Mocks hiding integration failures**: All mocked tests pass but real service calls fail → Use integration tests for critical paths; mock only external third-party services
- **Test coverage metric gamed by trivial assertions**: 100% coverage with `expect(true).toBe(true)` → Measure mutation testing score alongside coverage; flag tests with zero assertions
