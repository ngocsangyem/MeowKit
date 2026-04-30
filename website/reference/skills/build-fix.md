---
title: "mk:build-fix"
description: "Build error triage with language detection, fixability classification, auto-retry loop, and mk:verify chain."
---

# mk:build-fix

Detects language from error output, loads the appropriate fix reference, classifies fixability, applies the fix, and chains into `mk:verify` to confirm the build is green.

## What This Skill Does

`mk:build-fix` treats build errors as structured data, not free-form text. When a build fails, the error output contains signal: TypeScript errors have `TS####` codes, Python errors name the exception type, Go errors have recognizable patterns like `cannot find package`. This skill reads those signals, loads the appropriate language-specific reference, classifies whether the error can be auto-fixed or only diagnosed, and applies the minimum change needed.

After every fix attempt, it chains into `mk:verify` to confirm the build is actually green — not just that the immediate error message disappeared. If the build still fails, it tries a different approach. After 3 failed attempts it stops and escalates with full context: all 3 error outputs, all 3 attempted fixes, and a suspected root cause.

The skill enforces one security constraint unconditionally: TypeScript `any` is never used as a fix for type errors. `unknown` + type guards is the correct approach. See `security-rules.md`.

## Core Capabilities

- **Language detection** — Identifies TypeScript, Python, Go, Rust, or unknown from error output patterns
- **Fixability classification** — Three tiers: auto-fixable (apply immediately), suggest-with-confidence (explain then apply), report-only (diagnose, do not touch files)
- **Auto-retry loop** — Up to 3 attempts, each with a different approach; resets counter when switching errors
- **Verify chain** — Calls `mk:verify` after each fix to confirm actual green state
- **Escalation** — After 3 failures, delivers full diagnostic: all errors, all attempted fixes, root cause hypothesis

## When to Use This

::: tip Use mk:build-fix when...
- A build command fails with compilation or type errors
- TypeScript `tsc` reports `TS####` error codes
- Python raises `SyntaxError`, `ModuleNotFoundError`, or `IndentationError`
- Go or Rust reports missing packages or compilation failures
- Triggers: "build failed", "fix build", "compilation error", "type error"
:::

::: warning Don't use mk:build-fix when...
- The error is a runtime error, not a build/compile error — runtime errors need debugging, not build-fix
- The build fails due to an architectural issue requiring a refactor — the skill will classify these as report-only and stop
:::

## Usage

```bash
# Fix the current build failure
/mk:build-fix

# Pass error output directly
/mk:build-fix "error TS2345: Argument of type 'string' is not assignable"

# Point at a file with captured error output
/mk:build-fix build-error.txt
```

## Error Detection

Language is detected from error output patterns. First match wins:

| Pattern | Language | Reference loaded |
|---------|----------|-----------------|
| `error TS\d{4}:` | TypeScript | `references/typescript-errors.md` |
| `SyntaxError:` or `ModuleNotFoundError:` or `IndentationError:` | Python | `references/python-errors.md` |
| `cannot find package` or `undefined: ` | Go | `references/general-errors.md` |
| `error[E\d{4}]` | Rust | `references/general-errors.md` |
| Any other pattern | Unknown | `references/general-errors.md` |

The reference file is loaded before classification begins — pattern matching without reference context produces unreliable fixes.

## Fixability Classification

After loading the reference, each error is classified into one of three tiers:

| Class | Description | Action |
|-------|-------------|--------|
| **auto-fixable** | Syntax errors, missing imports, simple type mismatches | Apply fix immediately without asking |
| **suggest-with-confidence** | Wrong argument types, missing interface properties | Explain the fix briefly, then apply |
| **report-only** | Circular dependencies, architectural type mismatches, runtime errors masquerading as build errors | Describe problem and root cause; do not modify files |

Auto-fixable examples: `TS1005` (expected semicolon), `TS2307` (cannot find module — missing import), `SyntaxError: invalid syntax`.

Suggest-with-confidence examples: `TS2322` (type mismatch), `TS2345` (argument type mismatch), `ModuleNotFoundError` (missing dependency).

Report-only examples: circular dependency graphs, architectural type mismatches requiring interface changes, `TS2589` (type instantiation excessively deep).

## The Fix-Verify Loop

```
Capture error → Detect language → Load reference → Classify
  → Apply fix (if auto-fixable or suggest) → Run mk:verify
  → PASS? Done. FAIL? Attempt 2 with different approach.
  → FAIL again? Attempt 3 with different approach.
  → FAIL again? Escalate to user with full diagnostic.
```

Max 3 attempts. Each attempt must try a **different approach** — repeating the same fix after it failed is not self-healing, it is looping. The attempt counter resets when switching to a different error (e.g., fixing error A caused error B; counter resets for error B).

After 3 failures, escalate with:
- All 3 error outputs
- All 3 attempted fixes and why each failed
- Suspected root cause
- Suggested next steps (architectural review, dependency update, etc.)

## References

| File | Covers |
|------|--------|
| `references/typescript-errors.md` | 9 common TS error codes (`TS1005`, `TS2307`, `TS2322`, `TS2345`, `TS2339`, `TS2304`, `TS2741`, `TS2589`, `TS7006`) with fix patterns |
| `references/python-errors.md` | 7 exception types (`SyntaxError`, `IndentationError`, `ModuleNotFoundError`, `ImportError`, `AttributeError`, `TypeError`, `NameError`) with fixes |
| `references/general-errors.md` | Dependency errors, environment issues, build tool failures, Go and Rust patterns |

## Gotchas

- **Wrong language detection**: If the error output is truncated or a wrapper script obscures the real error, the pattern match fails and falls back to `general-errors.md`. Always capture the full error output including stderr.
- **Auto-fix making it worse**: Fixing a type error by changing a function signature can break callers. The skill applies the minimal change at the error site, but callers must be checked after each fix.
- **Infinite loop risk**: Three attempts with genuinely different approaches is the ceiling. If all three fail, escalate — do not expand the attempt count or loop back to approach 1.
- **Runtime errors misclassified as build errors**: A `TypeError` in Python at import time looks like a build error but is actually a runtime error. The skill classifies these as report-only rather than auto-fixing.
- **TypeScript `any` as a shortcut**: `any` silences the type error but defeats type safety. The skill will refuse to use `any` as a fix per `security-rules.md`. Use `unknown` + type guards instead.

## Related

- [`mk:verify`](/reference/skills/verify) — Called after each fix attempt to confirm green state
- [`mk:cook`](/reference/skills/cook) — Invokes build-fix during Phase 3 when build fails
- [`mk:testing`](/reference/skills/testing) — TDD reference; test failures are separate from build failures
