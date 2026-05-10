---
title: developer
description: Implementation agent — writes production code following approved plans. TDD is opt-in. Self-heals up to 3 times.
---

# developer

The developer is the builder. It takes approved plans and signed sprint contracts, then translates them into production code — following existing codebase patterns, maintaining type safety, and committing atomically per feature criterion. When things go wrong, it self-heals up to three times before escalating.

## Cognitive Framing

> *"Implement the plan, follow existing patterns, and never guess at architectural decisions."*

The developer operates at Phase 3 (Build). It is the only agent that writes production code in `src/`, `lib/`, and `app/`. Before touching any code, it reads the approved plan and signed sprint contract. In TDD mode, it confirms failing tests exist first. In default mode, it implements directly per the plan and acceptance criteria.

## Key Facts

| | |
|---|---|
| **Type** | Core |
| **Phase** | 3 (Build) |
| **Auto-activates** | After tester (Phase 2) or after planner (default mode) |
| **Owns** | `src/`, `lib/`, `app/` |
| **Never does** | Write tests (tester), write docs (documenter), write plans (planner), introduce new patterns without ADR, use `any` type, attempt more than 3 self-heal iterations |

## When to Use

- After **Gate 1 passes** — the developer only starts when an approved plan exists.
- In **TDD mode** — after the tester confirms failing tests exist (red phase).
- In **default mode** — after the planner produces an approved plan.
- During **harness-driven builds** — follows the 4-subphase generator pattern (Understand → Design Direction → Implement → Verify).

## Key Capabilities

- **Plan-driven implementation** — reads the approved plan and signed sprint contract before writing any code. In harness mode, also reads the sprint contract's acceptance criteria as the scope boundary.
- **TDD gate detection** — checks environment variables and sentinel files to determine TDD mode. In TDD mode, invokes the pre-implement gate hook before the first source-code edit.
- **Type-safe coding** — enforces no `any` types and no unsafe casts. Follows existing codebase patterns; new patterns require an ADR from the architect.
- **Self-healing** — on test failures, attempts fixes up to 3 times, each with a different approach. After 3 failures, escalates with detailed failure report.
- **Bead processing** — for Complex tasks with bead decomposition, processes beads sequentially by dependency order, commits per bead, and tracks progress for resume-on-interruption.
- **Generator pattern** — when invoked by `mk:harness`, follows a 4-subphase sequence: Understand, Design Direction, Implement, and Verify (self-eval checklist).

## Behavioral Checklist

- [x] Reads approved plan and sprint contract before starting — never implements without Gate 1
- [x] In TDD mode: confirms failing tests exist before writing code
- [x] Writes type-safe code with no `any` types or unsafe casts
- [x] Follows existing codebase patterns — new patterns require an ADR
- [x] Commits atomically per criterion (`feat: AC-NN ...`) or per bead
- [x] Self-heals up to 3 times on test failures, each with a different approach
- [x] Escalates after 3 failures with: failing test output, what was attempted, suspected root cause
- [x] Completes self-eval checklist before handoff in harness mode

## Common Use Cases

| Scenario | What the developer does |
|---|---|
| Standard feature implementation | Reads plan, implements code per acceptance criteria, commits per criterion, hands off to tester/reviewer |
| TDD feature development | Confirms failing tests exist, invokes gate hook, implements to make tests pass (green phase) |
| Harness-driven product build | Follows 4-subphase generator pattern: Understand → Design Direction → Implement → Verify |
| Complex bead-decomposed task | Processes beads sequentially, commits per bead, tracks progress for resume-on-interruption |
| Test failure self-healing | Attempts 3 different fix approaches. If all fail, escalates with detailed failure report |

## Generator Sub-Phases (Harness Mode)

When invoked by `mk:harness` or sprint-driven builds, the developer follows this sequence:

1. **Understand** — read contract and plan, identify unknowns, state in 3 bullets what will be built and how it will be verified.
2. **Design Direction** — pick existing pattern, sketch data flow in one paragraph, identify integration seams.
3. **Implement** — one criterion at a time, commit per criterion, stay within contract scope.
4. **Verify** — mandatory self-eval checklist before handoff: code compiles, routes match contract, DB schema applied, UI renders without errors, at least one criterion manually smoke-tested, git status clean.

## Pro Tips

### Read the Contract Before You Code

In harness mode, the sprint contract is immutable during implementation. Amendments require re-signing via `/mk:sprint-contract amend`. Read the contract's Scope (Out) section carefully — anything listed there is explicitly forbidden during implementation. This prevents scope creep and ensures the evaluator can grade against a fixed target.

### Combine Self-Healing with Root Cause Analysis

When a test fails, do not just apply a different fix each time. Each self-heal attempt should use a genuinely different approach informed by the failure output. If you find yourself making similar changes across attempts, the root cause is likely deeper than the surface symptom — escalate early rather than burning through attempts.

## Key Takeaway

The developer turns plans into production code, but never operates in a vacuum. It relies on approved plans, follows documented patterns, and enforces strict boundaries on what it can and cannot do. The self-healing mechanism provides resilience, while the hard escalation limit at 3 attempts prevents infinite loops.

## Related Agents

- **[planner](/reference/agents/planner)** — provides the approved plan that the developer implements
- **[tester](/reference/agents/tester)** — provides failing tests (TDD) or receives implementation for green-phase verification
- **[reviewer](/reference/agents/reviewer)** — reviews the implementation for Gate 2 approval
- **[architect](/reference/agents/architect)** — provides ADRs that constrain architectural decisions
- **[evaluator](/reference/agents/evaluator)** — grades the running build against rubrics in harness mode
