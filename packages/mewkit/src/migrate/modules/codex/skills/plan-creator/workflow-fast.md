# Plan Creator — Fast Mode Workflow

Compact workflow for `--fast` flag or simple tasks. Skips research, codebase analysis, red team, and validation interview.

## Rules

- NEVER load multiple step files simultaneously
- ALWAYS read entire step file before execution
- NEVER skip steps in the fast sequence
- ALWAYS halt at Gate 1 and wait for human approval

## Steps

1. `step-00-scope-challenge.md` — Assess complexity, confirm fast mode, early-exit trivial tasks
   - 1b. `step-00-5-intake-packet.md` — Conditional (≥2 external artifacts in invocation): consolidate pre-existing upstream artifacts into a Plan Intake Packet. 0–1 sources → clean skip.
2. `step-03-draft-plan.md` — Write plan.md overview only (no phase files in fast mode unless task warrants them)
3. `step-04-semantic-checks.md` — Semantic content checks only; skip structural validation
4. `step-07-gate.md` — Gate 1 presentation and approval
5. `step-08-hydrate-tasks.md` — Create session tasks + checkpoint file

**Skipped:** step-01 (research), step-02 (codebase analysis), step-05 (red team), step-06 (validation interview)

**Visual (opt-in via `--html`, incl. fast):** off by default. When `html_mode == true`,
the visual sub-steps fire even in fast mode — step-03 §3V (generate `visual-plan/plan.json`
+ minimal inline UI inventory), step-04 §4f (CLI probe + `mewkit visual-plan validate`, run
BEFORE the fast exit to step-07), step-07 §7v/§7c (visual preconditions +
`mewkit visual-plan approve`), step-08 (schema-1.3 `visual` block, CLI-managed), and
step-08b (export `plan.html` from the approved artifact). Because fast mode skips step-06
§6v (the studio-review step), a fast-mode `--html` plan SHOULD open the studio
(`mewkit visual-plan view {plan_dir}`) at Gate 1 so the human genuinely reviews the current
revision before `approve` — otherwise the §7v "reviewed current revision" precondition
is pro-forma. Without `--html`, none of it runs.
See `references/visual-plan-integration.md`.

## Variables

| Variable | Set by | Used by | Values |
|----------|--------|---------|--------|
| `planning_mode` | step-00 | all steps | `fast` (fixed in this workflow) |
| `task_complexity` | step-00 | step-03 | `simple` (trivial exits at step-00) |
| `workflow_model` | step-00 | step-03 | `feature`, `bugfix`, `refactor`, `security` |
| `tdd_mode` | step-00 | step-03 | `true` or `false` (composable flag, independent of planning_mode) |
| `html_mode` | step-00 | step-02, step-03, step-04, step-07, step-08b | `true` or `false` (composable flag; the single switch for ALL visual sub-steps) |
| `intake_packet_path` | step-00.5 | step-03 | Path to Plan Intake Packet, or `none` when < 2 external artifacts |
| `intake_sources_count` | step-00.5 | step-03 | Integer count of external artifacts consolidated |
| `plan_dir` | step-03 | step-04, step-07, step-08 | Absolute path to plan directory |

## Flow

```
Task description
    ↓
Step 0: Scope Challenge
    ├── trivial → "Use the fix skill" → STOP
    └── simple/complex → fast mode confirmed
         ↓
Step 0.5: Intake Packet (conditional — ≥2 external artifacts)
    ├── < 2 sources → skip clean (intake_packet_path = none)
    └── ≥ 2 sources → consolidate into .codex/session-state/plan-creator-intake-packet.md
         ↓
Step 3: Draft Plan
    └── plan.md only (≤80 lines, goal + ACs + constraints + approach)
         ↓
Step 4: Semantic Checks
    └── Semantic checks only — no structural validation, no red team
         ↓
Step 7: Gate 1
    └── Self-check → stop and ask the user in chat (Approve | Modify | Reject)
         ↓
Step 8: Hydrate Tasks
    └── Session tasks + .plan-state.json → cook command → STOP
```

## Next

Read and follow `step-00-scope-challenge.md`
