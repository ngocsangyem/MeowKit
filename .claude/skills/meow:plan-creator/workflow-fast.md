# Plan Creator — Fast Mode Workflow

Compact workflow for `--fast` flag or simple tasks. Skips research, codebase analysis, red team, and validation interview.

## Rules

- NEVER load multiple step files simultaneously
- ALWAYS read entire step file before execution
- NEVER skip steps in the fast sequence
- ALWAYS halt at Gate 1 and wait for human approval

## Steps

1. `step-00-scope-challenge.md` — Assess complexity, confirm fast mode, early-exit trivial tasks
2. `step-03-draft-plan.md` — Write plan.md overview only (no phase files in fast mode unless task warrants them)
3. `step-04-semantic-checks.md` — Semantic content checks only; skip structural validation
4. `step-07-gate.md` — Gate 1 presentation and approval
5. `step-08-hydrate-tasks.md` — Create Claude Tasks + checkpoint file

**Skipped:** step-01 (research), step-02 (codebase analysis), step-05 (red team), step-06 (validation interview)

## Variables

| Variable | Set by | Used by | Values |
|----------|--------|---------|--------|
| `planning_mode` | step-00 | all steps | `fast` (fixed in this workflow) |
| `task_complexity` | step-00 | step-03 | `simple` (trivial exits at step-00) |
| `workflow_model` | step-00 | step-03 | `feature`, `bugfix`, `refactor`, `security` |
| `tdd_mode` | step-00 | step-03 | `true` or `false` (composable flag, independent of planning_mode) |
| `plan_dir` | step-03 | step-04, step-07, step-08 | Absolute path to plan directory |

## Flow

```
Task description
    ↓
Step 0: Scope Challenge
    ├── trivial → "Use /meow:fix" → STOP
    └── simple/complex → fast mode confirmed
         ↓
Step 3: Draft Plan
    └── plan.md only (≤80 lines, goal + ACs + constraints + approach)
         ↓
Step 4: Semantic Checks
    └── Semantic checks only — no structural validation, no red team
         ↓
Step 7: Gate 1
    └── Self-check → AskUserQuestion (Approve | Modify | Reject)
         ↓
Step 8: Hydrate Tasks
    └── Claude Tasks + .plan-state.json → cook command → STOP
```

## Next

Read and follow `step-00-scope-challenge.md`
