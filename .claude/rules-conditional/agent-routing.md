---
source: MeowKit original
applies_to: [Phase 0, all]
# Unconditional load — orchestrator always needs the routing table.
---

# Agent Routing

| Agent           | Role                                             | Phase     |
| --------------- | ------------------------------------------------ | --------- |
| orchestrator    | Route tasks, assign model tier                   | 0         |
| planner         | Scope-adaptive plan (fast/hard/deep), Gate 1     | 1         |
| architect       | ADRs, system design                              | 1         |
| researcher      | Technology research, library evaluation          | 0, 1, 4   |
| brainstormer    | Trade-off analysis, solution exploration         | 1         |
| tester          | Write failing tests first                        | 2         |
| developer       | TDD implementation                               | 3         |
| ui-ux-designer  | UI design, accessibility, design systems         | 3         |
| security        | Audit, BLOCK verdicts                            | 2, 4      |
| reviewer        | Structural audit, Gate 2                         | 4         |
| evaluator       | Behavioral verification, rubric grading          | 3, 4      |
| shipper         | Deploy pipeline                                  | 5         |
| git-manager     | Git operations, conventional commits             | 5         |
| documenter      | Living docs, changelogs                          | 6         |
| analyst         | Cost tracking, patterns                          | 0, 6      |
| journal-writer  | Failure docs, root cause analysis                | 6         |
| project-manager | Cross-workflow delivery tracking, status reports | on-demand |

No two agents modify the same file type. Conflicts → escalate to human.

**Opt-out:** `MEOWKIT_PM_AUTO=off` disables all silent (background) project-manager fires from orchestration skills. User-invoked `/mk:status` is always honored. See `.claude/rules/post-phase-delegation.md` for fire points and skip conditions.
