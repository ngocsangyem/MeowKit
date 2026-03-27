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
