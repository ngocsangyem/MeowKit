# Feature Model

Applies when: adding new functionality, new endpoints, new UI components.

## Plan Shape
Required: Goal, Context, User Story, Scope, Constraints, Technical Approach, Acceptance Criteria, Agent State
Optional: API Changes, Migration Notes, Solution Options

## Phase Flow
1. Plan (Gate 1) → 2. Test RED → 3. Build GREEN → 4. Review (Gate 2) → 5. Ship

## Agent Sequence
planner → tester (write failing tests) → developer (implement) → reviewer → shipper

## Gate Points
- Gate 1: Plan approved by human before any code
- Gate 2: Review approved before shipping

## TDD Enforcement
Phase 2 is mandatory. Pre-implement hook blocks code without failing tests.

## Context Reminder (MANDATORY)

After Gate 1 approval, MUST print the cook command with absolute plan path.
Default: `/meow:cook {path}/plan.md`. With --fast: `/meow:cook --auto {path}/plan.md`

> **Best Practice:** Run `/clear` before implementing to reduce planning-context carryover.
> Then run the cook command.

This is **NON-NEGOTIABLE** — always output after plan approval.
