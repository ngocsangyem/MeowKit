# Plan Creator — Workflow

Step-file workflow for structured plan creation. Scope-aware with fast/hard modes.

## Rules

- NEVER load multiple step files simultaneously
- ALWAYS read entire step file before execution
- NEVER skip steps or optimize the sequence
- ALWAYS halt at Gate 1 and wait for human approval

## Steps

1. `step-00-scope-challenge.md` — Assess complexity, select mode (fast|hard), user scope input (hard: EXPANSION/HOLD/REDUCTION), early-exit trivial tasks
2. `step-01-research.md` — Spawn researchers (hard mode only). Bounded: 2 researchers, max 5 calls each. REDUCTION = 1 researcher.
3. `step-02-codebase-analysis.md` — Scout + project docs reading (hard mode only)
4. `step-03-draft-plan.md` — Write plan.md overview + phase-XX files. Integrate research findings. Verify research links in Context Links.
5. `step-04-validate-and-gate.md` — Semantic checks + **plan red team** (hard: 2 personas) + validation interview (hard) + Gate 1
6. `step-05-hydrate-tasks.md` — Create Claude Tasks from phase checkboxes + critical-step sub-tasks + checkpoint file

## Variables Passed Between Steps

| Variable | Set by | Used by | Values |
|----------|--------|---------|--------|
| `planning_mode` | step-00 | step-01, step-02, step-03, step-04 | `fast` or `hard` |
| `task_complexity` | step-00 | step-03 | `trivial` (exit), `simple`, `complex` |
| `workflow_model` | step-00 | step-03 | `feature`, `bugfix`, `refactor`, `security` |
| `scope_mode` | step-00 | step-01, step-03 | `EXPANSION`, `HOLD`, `REDUCTION` (hard mode; fast defaults to HOLD) |
| `research_reports` | step-01 | step-03 | List of report file paths |
| `codebase_findings` | step-02 | step-03 | Scout + docs summary |
| `plan_dir` | step-03 | step-04, step-05 | Absolute path to plan directory |

## Flow

```
Task description
    ↓
Step 0: Scope Challenge
    ├── trivial → "Use /meow:fix" → STOP
    ├── simple → fast mode → skip to Step 3
    └── complex → hard mode
         ├── User scope input: EXPANSION / HOLD / REDUCTION
         └── → Step 1
              ↓
Step 1: Research (hard only)
    ├── EXPANSION: 2 researchers, broader questions
    ├── HOLD: 2 researchers, standard
    ├── REDUCTION: 1 researcher, focused
    └── Reports saved to {plan-dir}/research/
         ↓
Step 2: Codebase Analysis (hard only)
    ├── meow:scout on relevant dirs
    └── Read project-context.md + docs/
         ↓
Step 3: Draft Plan
    ├── Read research reports (file paths from Step 1)
    ├── Write plan.md (overview, ≤80 lines, richer frontmatter)
    ├── Write phase-XX files (12-section template, hard mode)
    ├── Cross-plan dependency scan (blockedBy/blocks)
    └── Verify research links in phase Context Links
         ↓
Step 4: Validate + Gate 1
    ├── 4a. Semantic checks (goal=outcome, ACs=binary, constraints non-empty)
    ├── 4b. Structural validation (validate-plan.py)
    ├── 4c. Plan Red Team (hard: 2 personas — Assumption Destroyer + Scope Critic)
    ├── 4d. Validation interview (hard: 3-5 critical questions)
    └── 4e. Gate 1: AskUserQuestion (Approve | Modify | Reject)
         ↓
Step 5: Hydrate Tasks
    ├── TaskCreate per phase with addBlockedBy chain
    ├── Critical-step sub-tasks for [CRITICAL]/[HIGH] todo items
    ├── Create .plan-state.json checkpoint
    └── Output cook command with absolute path → STOP
```

## Next

Read and follow `step-00-scope-challenge.md`
