# Refactor Model

Applies when: restructuring code without changing behavior, reducing complexity, extracting modules.

## Plan Shape
Required: Goal, Motivation, Current State, Target State, Refactor Strategy, Backward Compatibility, Verification, Acceptance Criteria, Agent State
Optional: Solution Options (if multiple refactor approaches)

## Phase Flow
1. Plan (Gate 1) → 3. Implement (incremental) → 4. Review (Gate 2) → 5. Ship

## Agent Sequence
planner → developer (incremental changes, test after each) → reviewer → shipper

## Gate Points
- Gate 1: Plan approved
- Gate 2: All existing tests still pass, review approved

## Key Rule
Must be behavior-preserving. All existing tests must pass after every intermediate step.

## Context Reminder (MANDATORY)

After Gate 1 approval, MUST print the cook command with absolute plan path.
Default: `/mk:cook {path}/plan.md`. Incremental phases — cook handles each.

> **Best Practice:** Run `/clear` before implementing to reduce planning-context carryover.
> Then run the cook command.

This is **NON-NEGOTIABLE** — always output after plan approval.
