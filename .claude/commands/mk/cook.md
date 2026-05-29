# /cook — Implementation Pipeline

## Usage

```
/cook [feature description]
/cook [plan-path]
/cook [feature description] --tdd
```

## Purpose

Run the current implementation workflow for a single task: orient, plan, optionally test first, build, simplify, verify, review, ship, and reflect. The authoritative procedure lives in `mk:cook`.

## Dispatch

Activate `mk:cook` with the user's task or plan path. Keep Gate 1 (plan approval) and Gate 2 (review approval) intact.

## Flags

- `--tdd` — Opt into strict test-first mode for this run. Default: off.

## TDD mode dispatch (MANDATORY when `--tdd` is in invocation)

If the user invocation contains `--tdd`, the first action before any workflow step is to write the TDD sentinel file:

```bash
mkdir -p .claude/session-state && echo on > .claude/session-state/tdd-mode
```

This sentinel is the compatibility mechanism used by workflow helpers. `MEOWKIT_TDD=1` remains a higher-precedence environment opt-in for existing automation.

## Safety notes

- **Gate 1** (after Phase 1): Approve/reject/revise the plan.
- **Gate 2** (after Phase 4): Approve/reject the review verdict, acknowledge WARNs.
- Gate 2 is never auto-approved.
- In default mode, test-first enforcement is off unless the user requested tests or the approved plan requires them.
