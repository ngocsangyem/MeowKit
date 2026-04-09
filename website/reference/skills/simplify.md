---
title: "meow:simplify"
description: "Post-implementation complexity reduction. Removes dead code, unnecessary abstractions, and over-engineering between Phase 3 (Build) and Phase 4 (Review)."
---

# meow:simplify

Post-implementation simplification pass. Reduces complexity without changing behavior. Mandatory in meow:cook between Phase 3 (Build GREEN) and Phase 4 (Review).

## What This Skill Does

After implementation is complete and tests pass, meow:simplify scans modified files for complexity signals — dead code, unnecessary abstractions, over-engineering, redundant patterns — and removes them before the reviewer sees the code. The iron rule: behavior must not change. Every simplification must pass the same tests as before.

## When to Use

::: tip Mandatory in meow:cook
meow:simplify runs automatically between Phase 3 (Build) and Phase 4 (Review) in the meow:cook pipeline. This is enforced since v2.0.

```
Phase 2 (Test — RED if `--tdd`) → Phase 3 (Build) → [meow:simplify] → Phase 4 (Review)
```
:::

Can also be invoked standalone when you want to reduce complexity in existing code outside the cook pipeline.

## What It Checks

**Remove:**
- Dead code — functions never called, variables never read, unreachable branches, unused imports
- Commented-out code — if it's in git history, delete it from source
- Unnecessary abstractions — wrappers that add no value, interfaces with one implementation
- Redundant null checks — checking null after a guard that already prevents null

**Simplify:**
- Deep nesting — 3+ levels of if/else → extract early returns or guard clauses
- God functions — >50 lines → extract focused helpers
- Duplicate logic — same pattern in 3+ places → extract shared utility
- Complex conditions — `if (a && !b || (c && d))` → extract to named boolean or function

**Do not touch:**
- Working code that's "not how I'd write it" — style is not complexity
- Performance-optimized code — it looks complex for a reason
- Code outside the current diff — scope discipline applies even during simplification

## How It Works

1. **Identify** — scan changed files for complexity signals listed above
2. **Propose** — list each simplification with before/after preview
3. **Apply** — make changes one at a time (not batched)
4. **Verify** — run full test suite after each change
5. **Report** — list what was simplified and why

## Gotchas

- **Scope creep** — only simplify code from the current diff; touching unrelated code creates unexpected regressions
- **Dynamic references** — grep for string references before removing "dead" code; it may be used via reflection or dynamic import
- **Premature extraction** — 2 copies is not enough to justify a shared utility; wait for 3
- **Breaking public API** — simplifying internals is fine; changing exported signatures is a breaking change
- **Test code** — don't simplify test helpers or fixtures; they prioritize readability over DRY
- **Timing** — do not simplify during Phase 3 (Build); wait until tests pass GREEN, then simplify

## Related

- [meow:cook](/reference/skills/cook) — pipeline skill that mandates meow:simplify before Phase 4
- [meow:clean-code](/reference/skills/clean-code) — pragmatic coding standards (SRP, DRY, KISS)
- [meow:review](/reference/skills/review) — Phase 4 review that sees the simplified code
