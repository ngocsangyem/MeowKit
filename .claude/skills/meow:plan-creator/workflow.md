# Plan Creator — Workflow

Step-file workflow for structured plan creation. Scope-aware with fast/hard modes.
Fast mode uses `workflow-fast.md` (steps 00→03→04→07→08).

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
5. `step-04-semantic-checks.md` — Semantic checks + structural validation (validate-plan.py). Fast mode: skip validation, go to step-07.
6. `step-05-red-team.md` — Plan red team (hard only): phase-count persona scaling, subagent dispatch, adjudication, 3-option user review
7. `step-06-validation-interview.md` — Validation interview (hard only): 3-5 critical questions, propagate answers to phase files
8. `step-07-gate.md` — Self-check + Gate 1: AskUserQuestion (Approve | Modify | Reject)
9. `step-08-hydrate-tasks.md` — Create Claude Tasks from phase checkboxes + critical-step sub-tasks + checkpoint file

## Variables Passed Between Steps

| Variable | Set by | Used by | Values |
|----------|--------|---------|--------|
| `planning_mode` | step-00 | step-01, step-02, step-03, step-04, step-05, step-06 | `fast`, `hard`, `parallel`, or `two` |
| `task_complexity` | step-00 | step-03 | `trivial` (exit), `simple`, `complex` |
| `workflow_model` | step-00 | step-03 | `feature`, `bugfix`, `refactor`, `security` |
| `scope_mode` | step-00 | step-01, step-03 | `EXPANSION`, `HOLD`, `REDUCTION` (hard mode; fast defaults to HOLD) |
| `research_reports` | step-01 | step-03 | List of report file paths |
| `codebase_findings` | step-02 | step-03 | Scout + docs summary |
| `plan_dir` | step-03 | step-04, step-05, step-06, step-07, step-08 | Absolute path to plan directory |
| `red_team_findings` | step-05 | step-06 | Summary string: "{N} findings, {M} accepted" |
| `selected_approach` | step-04 | step-05, step-08 | `"a"` or `"b"` (two mode only; unset otherwise) |

## Flow

```
Task description
    ↓
Step 0: Scope Challenge
    ├── trivial → "Use /meow:fix" → STOP
    ├── simple → fast mode → use workflow-fast.md
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
Step 4: Semantic Checks
    ├── 4a. Semantic checks (goal=outcome, ACs=binary, constraints non-empty)
    ├── 4b. Structural validation (validate-plan.py) — must output PLAN_COMPLETE
    └── fast mode → skip to Step 7
         ↓
Step 5: Red Team (hard only)
    ├── Phase-count scaling: 1-3 phases=2 personas, 4-5=3, 6+=4
    ├── Load plan-specific personas from prompts/personas/
    ├── Dispatch subagents with plan-review override prompt
    ├── Collect → deduplicate → sort by severity → cap at 15
    ├── Agent adjudicates each: Accept/Reject + rationale
    └── AskUserQuestion: Apply all / Review each / Reject all
         ↓
Step 6: Validation Interview (hard only)
    ├── Generate 3-5 critical questions from plan content
    ├── Informed by red-team findings (step-05)
    └── Propagate answers to phase files
         ↓
Step 7: Gate 1
    ├── Self-check: Completed / Skipped / Uncertain
    └── AskUserQuestion (Approve | Modify | Reject)
         ↓
Step 8: Hydrate Tasks
    ├── TaskCreate per phase with addBlockedBy chain
    ├── Critical-step sub-tasks for [CRITICAL]/[HIGH] todo items
    ├── Create .plan-state.json checkpoint
    └── Output cook command with absolute path → STOP
```

## Mode Notes

- `--parallel` and `--two` both require `--hard` internally (full research pipeline runs).
- `--parallel`: step-03 adds ownership matrix; step-08 uses parallel group hydration.
- `--two`: step-03 produces 2 approach files (no plan.md yet); step-04 asks user to select before step-05.
- `selected_approach` is only set in `two` mode; all other modes leave it unset.

## Next

Read and follow `step-00-scope-challenge.md`
