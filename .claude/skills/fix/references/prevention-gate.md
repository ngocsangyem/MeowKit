# Prevention check

Run after the fix and before calling it complete.

## Regression test

`.claude/skills/cook/references/tdd-rules.md` decides when one is required: when behavior, security or a public contract can regress. Lint, format and config-only changes may omit it with a recorded reason. A flaky failure may use a probabilistic reproducer. A required test fails without the fix and passes with it.

## Defense in depth

Consider each layer; most fixes need one or two.

| Layer | When | Example |
|---|---|---|
| Entry validation | The fix involves user or external input | Validate and sanitize at the boundary |
| Business-logic guard | The fix involves data processing | Assertion or boundary check |
| Error handling | The failure is recoverable | try/catch, fallback, timeout |
| Type safety | Wrong type or null | Type guard, strict null check |

Common patterns: null or undefined gets a strict check and a guard; a race gets a lock or an idempotent operation; an unhandled edge case gets a boundary test; an environment-dependent bug gets an environment check with a clear error.

## Checklist

- The pre-fix state was captured and the fix addresses the root cause, not the symptom.
- The exact pre-fix commands were re-run and the before/after comparison is written down.
- The regression test exists (or the omission is justified) and no new warnings or errors appeared.
- The tests related to the change pass, and the full suite too when a shared contract or shared code changed.
