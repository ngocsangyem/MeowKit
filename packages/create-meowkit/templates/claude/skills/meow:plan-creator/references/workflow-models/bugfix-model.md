# Bug Fix Model

Applies when: fixing broken behavior, reported bugs, failed tests, runtime errors.

## Plan Shape
Required: Goal, Bug Report, Root Cause Analysis, Fix Approach, Regression Risk, Acceptance Criteria, Agent State
Optional: Context (if root cause is known), Solution Options (if multiple fix strategies)

## Phase Flow
1. Investigate → 2. Test (regression test — RED enforcement only with `--tdd` / `MEOWKIT_TDD=1`) → 3. Fix → 4. Review → 5. Ship

## Agent Sequence
- **TDD mode (`--tdd`):** investigator (meow:investigate) → tester → developer → reviewer → shipper
- **Default mode:** investigator → developer → reviewer → shipper. A regression test is recommended but not gated; tester may be inserted on-request.

## Gate Points
- Gate 1: Root cause confirmed before fix attempt
- Gate 2: Review approved, regression test passes

## Iron Law
No fix without confirmed root cause. 3-strike escalation if hypotheses fail.

## Context Reminder (MANDATORY)

After Gate 1 approval, MUST print the cook command with absolute plan path.
Default: `/meow:cook {path}/plan.md`. Quick fixes skip planning entirely.

> **Best Practice:** Run `/clear` before implementing to reduce planning-context carryover.
> Then run the cook command.

This is **NON-NEGOTIABLE** — always output after plan approval.
