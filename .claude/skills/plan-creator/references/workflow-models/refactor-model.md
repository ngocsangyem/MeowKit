# Refactor Model

Applies when: restructuring code without changing behavior, reducing complexity, extracting modules.

## Plan Shape
Required: Goal, Motivation, Current State, Target State, Refactor Strategy, Backward Compatibility, Verification, Acceptance Criteria
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
