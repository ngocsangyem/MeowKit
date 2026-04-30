# Feature Model

Applies when: adding new functionality, new endpoints, new UI components.

## Plan Shape
Required: Goal, Context, User Story, Scope, Constraints, Technical Approach, Acceptance Criteria, Agent State
Optional: API Changes, Migration Notes, Solution Options

## Phase Flow
1. Plan (Gate 1) → 2. Test (RED if `--tdd`, optional otherwise) → 3. Build → 4. Review (Gate 2) → 5. Ship

## Agent Sequence
- **TDD mode (`--tdd` / `MEOWKIT_TDD=1`):** planner → tester (write failing tests) → developer (implement) → reviewer → shipper
- **Default mode (TDD off):** planner → developer (implement directly) → reviewer → shipper. Tester may be invoked on-request or for plan-coverage reasons.

## Gate Points
- Gate 1: Plan approved by human before any code
- Gate 2: Review approved before shipping

## TDD Enforcement
Phase 2 is **OPT-IN.** With `--tdd` / `MEOWKIT_TDD=1`, the `pre-implement.sh` hook blocks code without failing tests (mandatory red phase). In default mode (TDD off), the hook is a no-op and the developer implements directly per the approved plan.

## Context Reminder (MANDATORY)

After Gate 1 approval, MUST print the cook command with absolute plan path.
Default: `/mk:cook {path}/plan.md`. With --fast: `/mk:cook --auto {path}/plan.md`

> **Best Practice:** Run `/clear` before implementing to reduce planning-context carryover.
> Then run the cook command.

This is **NON-NEGOTIABLE** — always output after plan approval.
