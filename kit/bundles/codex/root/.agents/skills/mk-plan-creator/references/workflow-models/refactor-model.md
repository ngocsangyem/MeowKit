# Refactor Model

Applies when: restructuring code without changing behavior, reducing complexity, extracting modules.

## Plan Shape
Required: Goal, Motivation, Current State, Target State, Refactor Strategy, Backward Compatibility, Verification, Acceptance Criteria, Agent State
Optional: Solution Options (if multiple refactor approaches)

## Phase Flow
1. Plan → 3. Implement (incremental) → 4. Review → 5. Ship

## Agent Sequence
planner → developer (incremental changes, test after each) → reviewer → shipper

## Checkpoints
- Before any code: plan agreed with the user
- Before shipping: all existing tests still pass, review verdict read

## Key Rule
Must be behavior-preserving. All existing tests must pass after every intermediate step.

## Context Reminder (MANDATORY)

Once the plan is agreed, MUST print the cook command with absolute plan path.
Default: `the cook skill {path}/plan.md`. Incremental phases — cook handles each.

> **Best Practice:** Run `/clear` before implementing to reduce planning-context carryover.
> Then run the cook command.

This is **NON-NEGOTIABLE** — always output once the plan is agreed.
