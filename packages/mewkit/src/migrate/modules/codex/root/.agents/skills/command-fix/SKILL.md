---
name: "command-fix"
description: "command-fix"
---

# /fix — Bug Fix

## Usage

```
/fix [bug description, error message, or CI failure log]
/fix [bug description] --tdd
/fix [bug description] --no-capture
```

## Purpose

Diagnose and fix a defect root-cause-first. Accepts direct bug descriptions, error
messages, stack traces, and CI failure logs. The authoritative procedure — mode selection,
memory check, scout, diagnosis, complexity routing, verification, and capture — lives in
`mk:fix`.

## Dispatch

Activate `mk:fix` with the user's bug description and any user-provided flags. Do not
classify, diagnose, or fix in this command; the skill owns the whole flow.

## Flags

- `--tdd` — Force a failing regression test before the fix. Default: regression tests are recommended but not gated.
- `--no-capture` — Suppress the skill's memory capture step.
- `--auto` | `--review` | `--quick` | `--parallel` — Execution mode. See `mk:fix` Arguments; the skill prompts for a mode when none is given.

## Safety notes

- Gate 1 and Gate 2 are human-approved per `.agents/skills/rule-gate-rules.md`; the skill's own routing decides which apply to a given fix, including the documented complexity=simple Gate 1 bypass.