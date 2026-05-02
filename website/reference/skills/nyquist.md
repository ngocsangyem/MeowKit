---
title: "mk:nyquist"
description: "Test-to-requirement coverage mapping — reads plan acceptance criteria and test files, produces coverage gap report."
---

# mk:nyquist

Maps plan acceptance criteria to test files. Identifies coverage gaps where requirements exist but no corresponding test validates them. Named after the Nyquist sampling theorem — sufficient test coverage prevents aliased (missed) requirements.

## When to use

- Phase 2 (Test): after tester writes initial tests, verify all ACs are covered
- Phase 4 (Review): as part of test coverage dimension, verify no gaps
- User says "check test coverage", "are all requirements tested", "coverage gaps"

NOT for running tests (use `mk:testing`) or structural code review (use `mk:review`).

## Process

Read-only analysis — reads plan and test files, produces gap report. Never modifies code.
