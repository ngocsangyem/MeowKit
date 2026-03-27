---
name: meow:investigate
preamble-tier: 2
version: 1.0.0
description: |
  Systematic debugging with root cause investigation. Four phases: investigate,
  analyze, hypothesize, implement. Iron Law: no fixes without root cause.
  Use when asked to "debug this", "fix this bug", "why is this broken",
  "investigate this error", or "root cause analysis".
  Proactively suggest when the user reports errors, unexpected behavior, or
  is troubleshooting why something stopped working.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - WebSearch
hooks:
  PreToolUse:
    - matcher: "Edit"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../freeze/bin/check-freeze.sh"
          statusMessage: "Checking debug scope boundary..."
    - matcher: "Write"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../freeze/bin/check-freeze.sh"
          statusMessage: "Checking debug scope boundary..."
source: gstack
---

<!-- Split for progressive disclosure (checklist #11, #14): 497 → ~65 lines -->
<!-- References loaded just-in-time, not all upfront -->

# Systematic Debugging

**Iron Law: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.**

## Plan-First Gate

Investigation precedes planning for bug fixes:
1. Confirm root cause FIRST (Iron Law)
2. After root cause confirmed → invoke `meow:plan-creator --type bugfix` if fix affects > 2 files

Skip: Investigation itself doesn't need a plan — it produces the input for planning.

## When to Use

- User reports errors, bugs, unexpected behavior
- "debug this", "fix this bug", "why is this broken"
- "investigate this error", "root cause analysis"
- Troubleshooting why something stopped working

## Process

1. **Run preamble** — load `references/preamble.md` and execute the startup bash block
2. **Collect symptoms** — read error messages, stack traces, reproduction steps
3. **Investigate root cause** — load `references/debugging-methodology.md` and follow Phase 1-3
4. **Lock scope** — restrict edits to affected module (via freeze hook)
5. **Implement fix** — follow Phase 4 from debugging methodology
6. **Verify** — reproduce original scenario, run test suite, output DEBUG REPORT
7. **Run shared protocols** — load `references/shared-protocols.md` for completion status + telemetry

## References

Load **only when executing** the corresponding step — not upfront.

| Reference | When to load | Content |
|-----------|-------------|---------|
| **[preamble.md](./references/preamble.md)** | Step 1 — skill startup | Session init, env detection, upgrade check |
| **[debugging-methodology.md](./references/debugging-methodology.md)** | Steps 2-6 — investigation + fix | 5-phase debugging: investigate → analyze → hypothesize → implement → verify |
| **[shared-protocols.md](./references/shared-protocols.md)** | Step 7 — completion | AskUserQuestion format, completion status, telemetry, contributor mode |

## Constraints

- **Read-only until hypothesis confirmed** — no edits until root cause identified
- **3-strike rule** — if 3 hypotheses fail, STOP and escalate
- **Minimal diff** — fix root cause with fewest files/lines possible
- **Regression test required** — must fail without fix, pass with fix
- **>5 files touched** — AskUserQuestion about blast radius before proceeding

## Hooks

- **Iron Law enforcement**: No fixes without confirmed root cause — this is a process constraint, not a technical hook
- The skill gates Phase 3 (Fix) behind Phase 1 (Investigate) completion
- If root cause cannot be confirmed after 3 hypotheses, escalate to human

## Gotchas

- **Confirming hypothesis without disproving alternatives**: Finding evidence FOR a theory doesn't mean it's correct → Actively test at least one alternative hypothesis before concluding
- **Log timestamps in wrong timezone**: Server logs in UTC, local comparison in local time → Normalize all timestamps to UTC before correlation
