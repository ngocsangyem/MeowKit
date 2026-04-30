# Plan Creator — Workflow

Step-file workflow for structured plan creation. Scope-aware with fast/hard modes.
Fast mode uses `workflow-fast.md` (steps 00→03→04→07→08).

## Rules

- NEVER load multiple step files simultaneously
- ALWAYS read entire step file before execution
- NEVER skip steps or optimize the sequence
- ALWAYS halt at Gate 1 and wait for human approval

## Steps

1. `step-00-scope-challenge.md` — Assess complexity, select mode (fast|hard|deep|parallel|two|product-level), user scope input (EXPANSION/HOLD/REDUCTION), early-exit trivial tasks
2. `step-01-research.md` — Spawn researchers (hard/deep/parallel/two only). Bounded: 2-3 researchers, max 5 calls each. REDUCTION = 1 researcher.
3. `step-02-codebase-analysis.md` — Scout + project docs reading (hard/deep/parallel/two only; deep: 2-3 parallel scouts)
4. `step-03-draft-plan.md` — Write plan.md overview + phase-XX files. Integrate research findings. Deep: per-phase scouting. TDD: inject 4 TDD sections.
   - **Branch:** if `planning_mode = product-level`, use `step-03a-product-spec.md` instead (writes plan.md only — user stories, features, design language; NO phase files).
5. `step-04-semantic-checks.md` — Semantic checks + structural validation (validate-plan.py). Fast mode: skip validation, go to step-07.
6. `step-05-red-team.md` — Plan red team (hard/deep/parallel/two only): 4-persona scaling, red-team-findings.md, subagent dispatch, adjudication
7. `step-06-validation-interview.md` — Validation interview (hard/deep/parallel/two only): 3-5 critical questions with detection keywords, section-mapped answer propagation
8. `step-07-gate.md` — Self-check + Gate 1: AskUserQuestion (Approve | Modify | Reject)
9. `step-08-hydrate-tasks.md` — Create Claude Tasks from phase checkboxes + critical-step sub-tasks + checkpoint file

## Variables Passed Between Steps

| Variable | Set by | Used by | Values |
|----------|--------|---------|--------|
| `planning_mode` | step-00 | step-01, step-02, step-03, step-04, step-05, step-06 | `fast`, `hard`, `deep`, `parallel`, `two`, or `product-level` |
| `task_complexity` | step-00 | step-03 | `trivial` (exit), `simple`, `complex` |
| `workflow_model` | step-00 | step-03 | `feature`, `bugfix`, `refactor`, `security` |
| `scope_mode` | step-00 | step-01, step-03 | `EXPANSION`, `HOLD`, `REDUCTION` (hard mode; fast defaults to HOLD; product-level defaults to EXPANSION) |
| `research_reports` | step-01 | step-03 | List of report file paths |
| `codebase_findings` | step-02 | step-03 | Scout + docs summary |
| `plan_dir` | step-03 | step-04, step-05, step-06, step-07, step-08 | Absolute path to plan directory |
| `red_team_findings` | step-05 | step-06 | Summary string: "{N} findings, {M} accepted" |
| `selected_approach` | step-04 | step-05, step-08 | `"a"` or `"b"` (two mode only; unset otherwise) |
| `tdd_mode` | step-00 | step-03 | `true` or `false` (composable flag, independent of planning_mode) |

## Flow

```
Task description
    ↓
Step 0: Scope Challenge
    ├── trivial → "Use /mk:fix" → STOP
    ├── simple → fast mode → use workflow-fast.md
    └── complex → hard or deep mode
         ├── deep auto-detected: 5+ dirs OR refactor+complex
         ├── User scope input: EXPANSION / HOLD / REDUCTION
         └── → Step 1
              ↓
Step 1: Research (hard/deep/parallel/two only)
    ├── EXPANSION: 2 researchers, broader questions
    ├── HOLD: 2 researchers, standard
    ├── REDUCTION: 1 researcher, focused
    ├── deep mode: 2-3 researchers
    └── Reports saved to {plan-dir}/research/
         ↓
Step 2: Codebase Analysis (hard/deep/parallel/two only)
    ├── hard: mk:scout on 2-3 relevant dirs
    ├── deep: mk:scout on 3-5 dirs, 2-3 parallel scouts
    └── Read project-context.md + docs/
         ↓
Step 3: Draft Plan
    ├── Read research reports (file paths from Step 1)
    ├── Write plan.md (overview, ≤80 lines, richer frontmatter)
    ├── Write phase-XX files (12-section template, hard/deep mode)
    ├── If tdd_mode=true: inject 4 TDD sections per phase file
    ├── If deep mode: per-phase scout → inject File Inventory + Dependency Map
    ├── Cross-plan dependency scan (blockedBy/blocks)
    ├── Verify research links in phase Context Links
    └── product-level mode → use step-03a (spec only, NO phase files)
         ↓
Step 4: Semantic Checks
    ├── 4a. Semantic checks (goal=outcome, ACs=binary, constraints non-empty)
    ├── 4b. Structural validation (validate-plan.py) — must output PLAN_COMPLETE
    └── fast mode → skip to Step 7
         ↓
Step 5: Red Team (hard/deep/parallel/two only — skipped in fast)
    ├── Phase-count scaling: 1-3=2 personas, 4-5=3, 6+=4
    ├── 4 personas: Assumption Destroyer, Scope Critic, Security Adversary, Failure Mode Analyst
    ├── Dispatch subagents with plan-review override prompt
    ├── Collect → deduplicate → sort by severity → cap at 15
    ├── Agent adjudicates each: Accept/Reject + rationale
    ├── Write red-team-findings.md (full detail)
    └── AskUserQuestion: Apply all / Review each / Reject all
         ↓
Step 6: Validation Interview (hard/deep/parallel/two only — skipped in fast)
    ├── Generate 3-5 critical questions using detection keywords framework
    ├── Informed by red-team findings (step-05)
    └── Propagate answers to phase files via section mapping
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

- `--deep` requires `--hard` internally (full research pipeline + per-phase scouting after step-03).
- `--parallel` and `--two` both require `--hard` internally (full research pipeline runs).
- `--parallel`: step-03 adds ownership matrix; step-08 uses parallel group hydration.
- `--two`: step-03 produces 2 approach files (no plan.md yet); step-04 asks user to select before step-05.
- `selected_approach` is only set in `two` mode; all other modes leave it unset.
- `--product-level`: step-03 → step-03a (spec only, no phase files). step-03a runs a LIGHT codebase scout (§3a.0) on non-empty repos via an ALLOWLIST of `README*`/`docs/`/`brand/`/`tasks/plans/` (BLOCKLIST: `src/`, source files, schemas) — output is injected as agent working memory only, never written to `plan.md`. Hands off to `mk:harness` after Gate 1, NOT directly to developer. Auto-detected by step-00 on green-field "build a X app" prompts; explicit flag bypasses detection. Optional: `--no-design` skips design subagent, `--no-scout` skips §3a.0 codebase scout.

## Next

Read and follow `step-00-scope-challenge.md`
