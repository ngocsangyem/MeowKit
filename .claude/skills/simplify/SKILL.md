---
name: mk:simplify
description: "Simplifies fresh code, same behavior. NOT for mk:clean-code."
argument-hint: '[file_or_directory]'
source: local
allowed-tools:
  - Read
  - Grep
  - Glob
  - Edit
  - Write
  - Bash
keywords:
  - simplify
  - behavior-preserving
  - refactor
  - reduce-complexity
  - yagni-pass
when_to_use: "Build green; shrink diff."
user-invocable: true
owner: docs
criticality: medium
status: active
runtime: claude-code
---

# Code Simplification

Goal: reduce the complexity of code you just built, with the same behavior, before review.

Scope is the current diff. A file or directory argument limits it to the files changed in the diff inside that path. For standards outside the diff use `mk:clean-code`, which also owns the numbers below.

## Iron Rule

> **Behavior must not change.** The tests that passed before must pass after. If they fail, the simplification was wrong: revert it.

If the project has no tests, or the baseline is already red, say so and stop, or limit yourself to changes you can prove equivalent by reading the code.

## What to Look For

### Remove

- **Dead code** — functions never called, variables never read, unreachable branches, import never used
- **Commented-out code** — if it's in git history, delete it from source
- **Unnecessary abstractions** — wrapper that adds no value, interface with one implementation
- **Redundant null checks** — checking null after a guard that already prevents null

### Simplify

- **Deep nesting** — about 3 levels of if/else → extract early returns or guard clauses
- **God functions** — past about 50 lines → extract focused helpers
- **Duplicate logic** — same pattern in 3+ places → extract shared utility
- **Complex conditions** — `if (a && !b || (c && d))` → extract to named boolean or function

### Don't Touch

- **Working code that's "not how I'd write it"** — style is not complexity
- **Performance-optimized code** — it looks complex for a reason
- **Code outside the current diff** — scope discipline, even for simplification

The line and nesting figures are rules of thumb (see `mk:clean-code`), not limits.

## Process

1. **Identify** — scan changed files for complexity signals
2. **Propose** — list each simplification with before/after preview
3. **Apply** — make changes one at a time
4. **Verify** — after each change (not batched) run the tests related to the changed files; run the broader suite once at the end
5. **Report** — list what was simplified and why

## Gotchas

- **"Just one more cleanup"** — scope creep is the #1 risk. Only simplify code from the current diff
- **Removing "dead" code that's used via reflection/dynamic import** — grep for string references, not just static imports
- **Extracting too early** — 2 copies is not enough to justify a shared utility. Wait for 3
- **Breaking public API** — simplifying internals is fine; changing exported signatures is a breaking change
- **Test-only code** — don't simplify test helpers/fixtures; they prioritize readability over DRY

## Pipeline Position

```
Phase 2 (Test — RED if `--tdd`) → Phase 3 (Build) → [mk:simplify] → Phase 4 (Review)
```

Simplification happens AFTER tests pass but BEFORE review. Reviewer sees the simplified code.
