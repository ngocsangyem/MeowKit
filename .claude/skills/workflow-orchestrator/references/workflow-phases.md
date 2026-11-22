<!-- Canonical source: workflow.yaml -->
<!-- Workflow phase sequence: 0:Orient > 1:Plan > 2:Test > 3:Build > 3.5:Simplify > 3.6:Verify > 4:Review > 5:Ship > 6:Reflect -->

# Phases at a glance

`workflow.yaml` owns the order, the leads, the transitions and the required outputs. This table is a render of it for reading, plus the one thing the YAML does not say: where the user is in the loop. What each phase expects and produces: `.claude/skills/cook/references/phase-contracts.md`. TDD rules: `.claude/skills/cook/references/tdd-rules.md`.

| Phase | Name | Lead | User |
| --- | --- | --- | --- |
| 0 | Orient | `mk:agent-detector` | none |
| 1 | Plan | `mk:plan-creator` | agrees the plan before Build |
| 2 | Test | `mk:testing` | none; RED tests only with `--tdd` / `MEOWKIT_TDD=1`, otherwise optional |
| 3 | Build | `mk:cook` / `developer` | none |
| 3.5 | Simplify | `mk:simplify` | none |
| 3.6 | Verify | `mk:verify` | none; a failure returns to Build |
| 4 | Review | `mk:review` | reads the verdict |
| 5 | Ship | `mk:ship` | asks for it |
| 6 | Reflect | `analyst`, `documenter`, `mk:memory` as the run needs | asks for it |

The user is in the loop twice, because those are the two places a mistake costs the most: the plan, before any code, and the review verdict, before shipping. No hook checks either; nothing blocks an edit without a plan or a commit without a verdict. The one enforced ship-time control is the `pre-ship` hook (lint, related tests, type-check).

Skipping Phase 1 (no plan) is invalid for a non-trivial task. Phase 3 without Phase 2 is invalid only in TDD mode.
