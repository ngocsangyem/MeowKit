---
title: TDD is now optional
description: Migration guide for the TDD-optional change. TDD enforcement is now opt-in via --tdd / MEOWKIT_TDD=1.
---

# TDD is now optional

> **As of this release, MeowKit's TDD enforcement is OPT-IN.** Default mode skips the RED-phase gate entirely. To restore strict TDD, pass `--tdd` to commands or set `MEOWKIT_TDD=1` in your shell.

## What changed

| Before | After |
|--------|-------|
| Every implementation required a failing test first | Failing tests required only when `--tdd` is set or `MEOWKIT_TDD=1` is exported |
| `pre-implement.sh` hook blocked source-code edits without RED tests | Hook is a no-op in default mode; only blocks in TDD mode |
| Developer agent refused to start without failing tests | Developer implements directly per the approved plan in default mode |
| Phase 2 was mandatory | Phase 2 is optional in default mode (skipped unless requested) |
| `tester` agent always invoked before `developer` | Tester invoked only in TDD mode or on-request |

**Unchanged:**
- Gate 1 (plan approval) and Gate 2 (review approval) — still hard gates, still require human sign-off
- Security rules (`security-rules.md`) and injection defense (`injection-rules.md`) — still apply in all modes
- Anti-rationalization rules in the tester agent (no test minimization, no mock substitution) — still apply when tests are written
- "Tests must pass before commit" from `development-rules.md` — still applies **IF tests exist**

## How to opt back in

### Per-command (recommended for one-off strict runs)

Pass `--tdd` to any cook/test/fix invocation:

```bash
/mk:cook --tdd "build payment processor"
/mk:fix --tdd "checkout total calculation off by one"
/mk:test --tdd
```

The slash command writes a sentinel file `.claude/session-state/tdd-mode` that hooks and downstream agents read. The sentinel persists for the session and is cleared at the next session start.

### Per-shell (recommended for CI / production projects)

Export the environment variable:

```bash
# In your shell rc, .envrc, or CI config
export MEOWKIT_TDD=1
```

Env var overrides everything else (highest precedence). Useful when an entire project should always enforce TDD.

### In `mewkit doctor` and benchmarks

`MEOWKIT_TDD=1` flips strict mode for any tool that consults the helper.

## In-flight plans from before the migration

If you have plans under `tasks/plans/*` with `phase-02-test-red.md` sections that were generated before this migration, those plan files ASSUME strict TDD. You have three options:

1. **Finish under strict mode:** `export MEOWKIT_TDD=1` for the rest of the feature, then complete normally
2. **Update in place:** edit the phase-02 section to note "optional post-migration" and let the developer implement directly
3. **Regenerate:** re-run `mk:plan-creator` for the remaining phases under default mode

You can self-check for stale plans by running:
```bash
grep -rn "Phase 2 Test RED\|Phase 2: Test RED" tasks/plans/
```
If matches return, those plans were authored under strict TDD assumptions and need one of the three options above before continuing.

## `MEOW_PROFILE=fast` deprecation

Legacy users: `MEOW_PROFILE=fast` still bypasses TDD, but now emits a stderr deprecation warning on first use per session:

```
[tdd] DEPRECATION: MEOW_PROFILE=fast will be removed in the next major version; use MEOWKIT_TDD=1 or --tdd flag instead (or unset for the new default-OFF behavior)
```

The alias will be removed in the next MAJOR version (v3.0 or equivalent). Migrate to:

- **Default mode** (no env var, no flag) — matches the old `fast` profile behavior for TDD bypass
- **`MEOWKIT_TDD=1`** / **`--tdd`** — for explicit strict mode

No immediate action required; update before v3.0 ships.

## Why optional?

User feedback: strict TDD added friction for spike work, tooling scripts, and prototypes — exactly the contexts where iteration speed matters most. Production-quality work should still enable `--tdd`. The opt-in design matches how most modern CLIs handle discipline modes (linters, type-checkers, formatters): permissive by default, strict on opt-in.

## Action required

**None** if you're happy with the new default. If you want strict TDD on every run, add `MEOWKIT_TDD=1` to your environment now.

## Related

- [`tdd-rules.md`](/reference/rules-index) — the rule file (now opt-in)
- [`pre-implement.sh`](/reference/hooks) — the hook (now opt-in)
- [`developer.md`](/reference/agents/developer) — the agent (now opt-in)
- [`tester.md`](/reference/agents/tester) — the agent (now opt-in)
- [`mk:cook`](/reference/skills/cook) — the entry point (`--tdd` flag added)
