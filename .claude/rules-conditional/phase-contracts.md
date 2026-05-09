---
source: MeowKit original
applies_to: [Phase 1, 2, 3, 4, 5, 6]
# Unconditional load — target task directories (`tasks/plans/`, `tasks/contracts/`)
# contain only `.gitkeep` at plan-creation time. Path-scoping would defer the rule
# until a plan exists, which is too late for orchestrators that need it at session
# start. (Red-team finding #2 — 2026-05-09 plan validation.)
---

# Phase Composition Contracts

What each phase expects and produces. Breaking upstream contracts cascades downstream.

| Phase     | Skill             | Expects                              | Produces                                                 | Breaks-if-Missing                      |
| --------- | ----------------- | ------------------------------------ | -------------------------------------------------------- | -------------------------------------- |
| 0 Orient  | mk:agent-detector | Task description                     | Agent assignment + model tier                            | No routing → wrong agent/tier          |
| 1 Plan    | mk:plan-creator   | Task with enough detail for scope    | plan.md + phase files                                    | Gate 1 blocks (hook-enforced)          |
| 2 Test    | mk:testing        | Plan with acceptance criteria        | Failing tests targeting criteria                         | No correctness proof for Phase 3       |
| 3 Build   | mk:cook           | Approved plan (Gate 1), tests if TDD | Passing code + committed increments                      | Builds wrong thing without plan        |
| 4 Review  | mk:review         | Committed code with passing tests    | Verdict (PASS/WARN/FAIL per dimension)                   | Can't assess correctness without tests |
| 5 Ship    | mk:ship           | PASS/WARN verdict (Gate 2)           | PR + branch push                                         | Ships unreviewed code                  |
| 6 Reflect | mk:memory         | Completed work with decisions        | topic file entries (fixes.md, architecture-decisions.md) | Knowledge lost (non-blocking)          |
