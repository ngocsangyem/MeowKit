# Feature Model

Applies when: adding new functionality, new endpoints, new UI components.

## Plan Shape
Required: Goal, Context, User Story, Scope, Constraints, Technical Approach, Acceptance Criteria, Agent State
Optional: API Changes, Migration Notes, Solution Options

## Phase Flow
1. Plan → 2. Test (RED if `--tdd`, optional otherwise) → 3. Build → 4. Review → 5. Ship

## Agent Sequence
- **TDD mode (`--tdd` / `MEOWKIT_TDD=1`):** planner → tester (write failing tests) → developer (implement) → reviewer → shipper
- **Default mode (TDD off):** planner → developer (implement directly) → reviewer → shipper. Tester may be invoked on-request or for plan-coverage reasons.

## Checkpoints
- Before any code: plan agreed with the user
- Before shipping: review verdict read

## TDD Enforcement
Phase 2 is **OPT-IN.** With `--tdd` / `MEOWKIT_TDD=1`, write the failing tests first and do not start implementing until they fail. In default mode (TDD off), the developer implements directly per the agreed plan.

## Context Reminder (MANDATORY)

Once the plan is agreed, MUST print the cook command with absolute plan path.
Default: `the cook skill {path}/plan.md`. With --fast: `the cook skill --auto {path}/plan.md`

> **Best Practice:** Run `/clear` before implementing to reduce planning-context carryover.
> Then run the cook command.

This is **NON-NEGOTIABLE** — always output after plan approval.
