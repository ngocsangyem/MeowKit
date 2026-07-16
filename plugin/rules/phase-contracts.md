---
source: original
applies_to: [Phase 0, 1, 2, 3, 4, 5, 6]
# Unconditional load — target task directories (`tasks/plans/`, `tasks/contracts/`)
# contain only `.gitkeep` at plan-creation time. Path-scoping would defer the rule
# until a plan exists, which is too late for orchestrators that need it at session
# start. (Red-team finding #2 — 2026-05-09 plan validation.)
---

<!-- Canonical source: .claude/workflow.yaml -->
<!-- Workflow phase sequence: 0:Orient > 1:Plan > 2:Test > 3:Build > 3.5:Simplify > 3.6:Verify > 4:Review > 5:Ship > 6:Reflect -->

# Phase Composition Contracts

What each phase expects and produces. Breaking upstream contracts cascades downstream.

| Phase        | Skill                          | Expects                              | Produces                                                 | Breaks-if-Missing                      |
| ------------ | ------------------------------ | ------------------------------------ | -------------------------------------------------------- | -------------------------------------- |
| 0 Orient     | mk:agent-detector              | Task description                     | Agent assignment + model tier                            | No routing → wrong agent/tier          |
| 1 Plan       | mk:plan-creator                | Task with enough detail for scope    | plan.md + phase files                                    | Gate 1 blocks (hook-enforced)          |
| 2 Test       | mk:testing                     | Plan with acceptance criteria        | Failing tests targeting criteria                         | No correctness proof for Phase 3       |
| 3 Build      | mk:cook                        | Approved plan (Gate 1), tests if TDD | Passing code + committed increments                      | Builds wrong thing without plan        |
| 3.5 Simplify | mk:simplify (via developer)    | Passing code from Phase 3            | Simplified code (same tests still pass)                  | Reviewer works with complex code       |
| 3.6 Verify   | mk:verify                      | Simplified code                      | Clean build+lint+type+test+coverage result               | Review starts with broken signal       |
| 4 Review     | mk:review                      | Committed code with passing tests    | Verdict (PASS/WARN/FAIL per dimension)                   | Can't assess correctness without tests |
| 5 Ship       | mk:ship                        | PASS/WARN verdict (Gate 2)           | PR + branch push                                         | Ships unreviewed code                  |
| 6 Reflect    | analyst + documenter + mk:memory | Completed work with decisions      | Memory entries, docs sync                                | Knowledge lost (non-blocking)          |
