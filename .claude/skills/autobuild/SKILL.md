---
name: mk:autobuild
version: 1.0.0
preamble-tier: 3
description: "Builds a green-field product unattended. NOT for mk:cook."
argument-hint: '[task description] [--tier auto|full|lean|minimal] [--max-iter N] [--budget USD] [--tdd] [--advice]'
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
source: local
keywords:
  - harness
  - autonomous-build
  - green-field
  - generator-evaluator
  - harness-contract
  - adaptive-density
when_to_use: "A full product spec to build."
user-invocable: true
meowkit:
  portability: provider-only
  providers:
    include:
      - claude-code
  requires:
    surfaces:
      - skills
    commands:
      - Agent
      - AskUserQuestion
      - Bash
    env:
      - CLAUDE_PROJECT_DIR
  context_cost: high
owner: lifecycle
criticality: high
status: active
runtime: claude-code
context_cost: high
---

<!-- Lifecycle canonical source: .claude/skills/workflow-orchestrator/workflow.yaml — autobuild steps are Step 0–6 (distinct from the 7 lifecycle phases) -->

# mk:autobuild

> Script paths in this skill's other files are relative to this skill's directory, `${CLAUDE_SKILL_DIR}`. Prefix them with it before running; do not run them from the project root.

Build a green-field product from a spec, unattended: plan at product level, agree a sprint contract, generate, have an independent evaluator drive the running build, iterate within a cap, and leave an audit trail. The amount of scaffolding adapts to the model (density below).

Use it for "build me an app" scope, a multi-hour run with no hand-holding. Do not use it for a single feature, bug fix or refactor (`mk:cook`), a doc update, or "explain X" and "review Y".

It coexists with `mk:cook`: both plan with the user first and review the result before shipping.

## Constraints

1. **Density adapts to the model.** the density matrix (`references/adaptive-density-matrix.md`) owns the table and the override order; `scripts/density-select.sh` implements it. An unknown model gets FULL. `MEOWKIT_AUTOBUILD_MODE` overrides detection.
2. **Budget.** `scripts/budget-tracker.sh` warns, then blocks, then honours a user cap (`--budget`); its thresholds come from `.meowkit/config.yaml`. When it says block, the run halts even mid-iteration, because a runaway build costs more than an unfinished one.
3. **Wall-clock stop at 6 hours.** Past that, long runs drift; write the report and ask the user. Each step ends with a commit so a run can restart from where it stopped.
4. **Iteration cap of 3 rounds** between generator and evaluator (`--max-iter`). A build that has not converged by then needs a person.
5. **Every run writes a report** at `tasks/autobuild-runs/YYMMDD-HHMM-{slug}/run.md`, including failed, timed-out and escalated runs.
6. **The generator is not the evaluator.** They are separate subagents with separate contexts, and the evaluator must drive the running build (browser, curl or CLI), because a static read passes builds that do not run.
7. **TDD is opt-in** (`--tdd`), as in `mk:cook`: the `.meowkit/state/tdd-mode` sentinel is written and the developer waits on the tester each iteration. Active verification applies either way.

## `--advice` (composable, off by default)

Opt-in supervision by the `athena` agent at macro checkpoints only (GUIDE at the Plan/Contract boundary, RESCUE on a plateau or scope drift, REVIEW after the terminal verdict and before the ship question, RECHECK after a correction; cap 5 per run). It never approves: the ship decision stays the user's, the evaluator keeps its verdict, and supervision counts as no verification. Without the flag there are zero calls. Checkpoints: `references/advice-checkpoints.md`; contract: `.claude/skills/advise/references/advice-supervision-rules.md` (load only with the flag).

## Steps

Read `workflow.md`, then one step file at a time. Each step file gives its goal, inputs, done check and the brief for its subagent.

```
Step 0  Tier detection   pick density (MINIMAL | FULL | LEAN), create the run directory
Step 1  Plan             mk:plan-creator --product-level
Step 2  Contract         mk:sprint-contract, skipped when density or size makes it dead weight
Step 3  Generate         developer subagent builds to the contract
Step 4  Evaluate         mk:evaluate drives the running build
Step 5  Iterate or ship  PASS or cap reached: ask the user; otherwise back to Step 3
Step 6  Run report       finish the audit trail
```

## Stop and report

Stop and tell the user, rather than working around it, when: the plan is rejected, a contract will not get signed, the budget blocks, the wall-clock stop is reached, the evaluator cannot run the build, or the cap is hit with a FAIL. Write the report first. The run returns the four-status block (`DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`); `workflow.md` says which status fits which end state.

## Gotchas

- **Not for single features.** Use `mk:cook`; autobuild is for "build me an app".
- **A density override drops scaffolding, not the bar.** `LEAN` skips the contract, not the review: still review the diff and write the verdict before shipping.
- **Iteration loops are bounded.** After round 3, escalate instead of iterating blindly.
- **Reports are append-only.** Do not edit earlier steps' entries; the report is the audit trail.
- **The ship question is the user's.** A PASS verdict is evidence for that decision, not the decision.

## Rule loads (just in time)

| Load at | File |
| --- | --- |
| Step 0 | the density matrix, `references/adaptive-density-matrix.md` (table and override order) |
| Step 3, only when generation is parallelized | `.claude/skills/cook/references/parallel-execution-rules.md` |
| Steps 5 and 6, before a project-manager delegation | `.claude/skills/cook/references/post-phase-delegation.md` |
| A teams-versus-subagents question | `references/agent-teams-vs-subagents.md` |

## Files

| File | Purpose |
|---|---|
| `workflow.md` | step order, run state, shared rules |
| `step-00-tier-detection.md` … `step-06-run-report.md` | one per step |
| `references/advice-checkpoints.md` | `--advice` checkpoints |
| `scripts/density-select.sh`, `scripts/budget-tracker.sh` | density selector; cost log with threshold exit codes |
| `../plan-creator/`, `../sprint-contract/`, `../rubric/`, `../evaluate/`, `../scale-routing/` | the skills each step calls |
