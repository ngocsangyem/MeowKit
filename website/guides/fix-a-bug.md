---
title: Fix a Bug
description: Structured bug investigation with /mk:fix — root cause analysis, regression tests, and memory capture.
---

# Fix a Bug

`/mk:fix` is MeowKit's debugging pipeline. Instead of immediately editing code, it forces structured investigation: find the root cause, write a regression test, apply the minimal fix. The approach adapts to bug complexity automatically.

## Quick start

```bash
/mk:fix login fails after 24 hours
```

MeowKit auto-detects complexity and runs the appropriate workflow. A typo gets a quick fix. A race condition gets full investigation with parallel exploration.

## Choosing the right mode

| Bug type | Command | What happens |
|----------|---------|-------------|
| Typo, config, lint error | `/mk:fix "typo in README" --quick` | Direct fix, no investigation |
| Logic bug, one module | `/mk:fix "session token not refreshed"` | Investigate → diagnose → fix → test |
| Cross-module, intermittent | `/mk:fix "race condition in payment queue"` | Full investigation with parallel exploration |
| Multi-file test failures | `/mk:fix "all failing tests in checkout" --parallel` | Parallel agents per issue |

## What happens step by step

```
Bug reported
  → Step 0: Mode selection (quick / standard / deep)
  → Step 0.5: Check memory — has this bug class been fixed before?
  → Step 1: Scout — mandatory codebase exploration (mk:scout)
  → Step 2: Diagnose — investigate + sequential-thinking for root cause
  → Step 3: Complexity assessment
  → Step 4: Fix — address ROOT cause, not symptoms
  → Step 5: Verify — regression test (mandatory)
  → Step 6: Write to memory — pattern captured for future bugs
```

## Hard stops

- **No fix before Steps 1-2 complete.** Scout and diagnose are mandatory.
- **Confidence below "medium" blocks the fix.** More evidence is required.
- **3 failed fix attempts stops the pipeline.** The architecture needs review, not a fourth attempt.

## When to review mode

```bash
/mk:fix payment processing timeout --review
```

Pauses for your approval at each step. Use when:
- The bug is in a security-critical path
- You want to validate the diagnosis before the fix
- The fix has regulatory implications

## After the fix

Every fix writes to `.claude/memory/fixes.md` and `fixes.json`. Next time a similar bug appears, Step 0.5 finds the pattern and fast-tracks diagnosis. After 3+ occurrences of the same bug class, the pattern is promoted to a `CLAUDE.md` rule.

## Don't use /mk:fix for

- **New features** → use `/mk:cook`
- **Architecture decisions** → use `/mk:party` or `/mk:plan-creator`
- **"Why is this broken?" without fixing** → use `/mk:investigate`

## Next steps

- [Debug effectively](/guides/debug-effectively) — when to use fix vs investigate vs sequential-thinking
- [Build a feature](/guides/build-a-feature) — the full feature pipeline
- [Understand the workflow](/core-concepts/workflow)
