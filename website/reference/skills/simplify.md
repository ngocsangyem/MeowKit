---
title: "mk:simplify"
description: "Post-implementation simplification pass — reduces complexity without changing behavior. Runs after Phase 3 GREEN, before Phase 4 Review."
---

# mk:simplify

Runs after implementation, before review. Behavior-preserving simplification: reduces complexity while passing the exact same tests. Scoped to the current diff only.

> For ad-hoc code quality review outside the current implementation diff, use `mk:clean-code`. `mk:simplify` is behavior-preserving and scoped to the current diff only.

## What This Skill Does

A post-implementation simplification pass that catches dead code, unnecessary abstractions, over-engineering, and redundant patterns. It operates between Phase 3 (Build GREEN) and Phase 4 (Review) so the reviewer sees clean, simplified code. Every change is verified by running the full test suite — if any test fails, the change is reverted.

## When to Use

**Auto-called** by `mk:cook` after implementation passes tests.

**Explicit:** `/mk:simplify [file_or_directory]`

**Triggers on:** "simplify", "clean up", "reduce complexity", "too complex".

**Do NOT invoke for:** style/convention enforcement (use `mk:clean-code`), reviewing diffs or PRs (use `mk:review`).

## Core Capabilities

- **Remove dead code** — functions never called, variables never read, unreachable branches
- **Remove commented-out code** — if it's in git history, delete from source
- **Remove unnecessary abstractions** — wrappers adding no value, interfaces with one implementation
- **Remove redundant null checks** — checking null after a guard already prevents it
- **Remove boolean traps** — functions with 4+ boolean params where names hide meaning
- **Simplify nested conditionals** — extract early returns or guard clauses
- **Simplify complex boolean expressions** — extract to named variables or functions
- **Simplify god functions** — extract focused helpers from functions exceeding 50 lines
- **Simplify duplicate logic** — extract shared utility when same pattern appears in 3+ places
- **Inline once-called abstractions** — collapse into their single call site

## Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `file_or_directory` | string | Optional. Target file or directory to simplify. Defaults to current diff. |

## Workflow

### Pipeline Position

```
Phase 2 (Test — RED if --tdd) -> Phase 3 (Build) -> [mk:simplify] -> Phase 4 (Review)
```

Simplification happens AFTER tests pass but BEFORE review. Reviewer sees the simplified code.

### Process

1. **Identify** — scan changed files for complexity signals
2. **Propose** — list each simplification with before/after preview
3. **Apply** — make changes one at a time
4. **Verify** — run full test suite after each change (not batched)
5. **Report** — list what was simplified and why

### Hard Constraint

Never simplify across file boundaries. If two files are coupled in a way that makes simplifications unsafe, flag them as "coupled" and stop — don't attempt cleanup.

## Iron Rule

> **Behavior must not change.** Every simplification must pass the exact same tests as before. If tests fail after simplification, the simplification was wrong — revert it.

## What to Look For

### Remove

- **Dead code** — functions never called, variables never read, unreachable branches, imports never used
- **Commented-out code** — if it's in git history, delete it from source
- **Unnecessary abstractions** — wrapper that adds no value, interface with one implementation
- **Redundant null checks** — checking null after a guard that already prevents null
- **Boolean traps** — function with 4 boolean params where names hide meaning

### Simplify

- **Deep nesting** — 3+ levels of if/else -> extract early returns or guard clauses
- **God functions** — >50 lines -> extract focused helpers
- **Duplicate logic** — same pattern in 3+ places -> extract shared utility
- **Complex conditions** — `if (a && !b || (c && d))` -> extract to named boolean or function

### Don't Touch

- **Working code that's "not how I'd write it"** — style is not complexity
- **Performance-optimized code** — it looks complex for a reason
- **Code outside the current diff** — scope discipline, even for simplification

## Gotchas

- **"Just one more cleanup"** — scope creep is the #1 risk. Only simplify code from the current diff.
- **Removing "dead" code that's used via reflection/dynamic import** — grep for string references, not just static imports.
- **Extracting too early** — 2 copies is not enough to justify a shared utility. Wait for 3.
- **Breaking public API** — simplifying internals is fine; changing exported signatures is a breaking change.
- **Test-only code** — don't simplify test helpers/fixtures; they prioritize readability over DRY.

## Common Use Cases

- Post-implementation cleanup before code review
- Reducing complexity after a large feature merge
- Removing debugging code left after development
- Flattening deeply nested conditionals that grew during feature work
- Extracting shared logic that appeared naturally across 3+ modules

## Example Prompt

> /mk:simplify src/features/checkout
> I just finished building the checkout flow and it got messy during feature work. Simplify it — remove dead code, flatten deep nesting, extract duplicated logic — but don't change any behavior. Run tests after every change.

## Pro Tips

- Run tests after EVERY single change — never batch simplifications
- If a simplification fails tests, revert it immediately — don't try to fix the simplification
- Scope strictly to the current diff — clean code outside the diff is for `mk:clean-code`, not `mk:simplify`
- When in doubt about "dead code", grep for string references — dynamic imports and reflection can hide usage
- Leave test code alone — test readability matters more than test DRY
