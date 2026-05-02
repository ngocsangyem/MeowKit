---
title: "mk:harness"
description: "Autonomous green-field build pipeline — planner, contract, generator/evaluator loop with adaptive density."
---

# mk:harness

## What This Skill Does

Autonomous build pipeline for green-field products. Runs planner → contract → generator ⇄ evaluator loop with scaffolding density auto-tuned to model tier. For single features, use `mk:cook`.

## When to Use

- Building a green-field product from scratch (kanban app, SaaS platform, retro game maker)
- Multi-hour autonomous builds with no manual handholding
- Any "build me an app" or "create a [product]" request
- **NOT for:** single features, bug fixes, or refactors (use `mk:cook`), documentation updates, or explain/review requests

## Core Capabilities

- **Adaptive density:** Auto-selects MINIMAL / FULL / LEAN scaffolding based on model tier via `mk:scale-routing`, honors `MEOWKIT_HARNESS_MODE` override
- **Generator ⇄ evaluator loop:** Developer subagent builds, evaluator verifies against rubrics, iterates up to 3 rounds before escalating
- **Budget enforcement:** Warns at $30, requires approval at $100, hard-blocks at user-set `--budget` value
- **Run reports:** Every run produces a full audit trail at `tasks/harness-runs/YYMMDD-{slug}/run.md` including budget trail, per-step artifacts, and final verdict
- **Resumability:** Checkpoints at every step — if killed mid-run, `--resume {run-id}` picks up at the last completed step
- **TDD opt-in:** `--tdd` writes the `.claude/session-state/tdd-mode` sentinel; developer waits on tester before each generator iteration

## Usage

```bash
/mk:harness build a kanban board with drag-and-drop
/mk:harness build a todo app --tier full              # Force FULL density
/mk:harness build a retro game maker --tier lean       # Force LEAN
/mk:harness build a markdown editor --budget 25 --max-iter 2
/mk:harness --resume 260501-1450-build-kanban          # Resume interrupted run
/mk:harness "build payment system" --tdd               # TDD enforcement
```

## Example Prompt

```
Build a kanban board with drag-and-drop, swim lanes, and real-time collaboration. Support up to 10 concurrent users. Use a $50 budget cap and max 2 iteration rounds.
```

## Workflow (step-file — one step at a time)

| Step | Action |
|---|---|
| 0 — Tier Detection | `mk:scale-routing` picks MINIMAL / FULL / LEAN; honors `MEOWKIT_HARNESS_MODE` |
| 1 — Plan | `mk:plan-creator --product-level` — user stories, not file paths |
| 2 — Contract | `mk:sprint-contract` (FULL: required, LEAN: optional if ACs < 5, MINIMAL: skip) |
| 3 — Generate | Developer subagent with 4-subphase pattern (Understand → Design → Implement → Verify) |
| 4 — Evaluate | `mk:evaluate` — active verification against rubrics |
| 5 — Iterate or Ship | PASS → shipper; FAIL → loop to step 3 (max `--max-iter` rounds, default 3) |
| 6 — Run Report | Append-only audit trail at `tasks/harness-runs/YYMMDD-{slug}/run.md` |

## Density modes

| Mode | Model | Planner | Contract | Iterations | Context Reset |
|---|---|---|---|---|---|
| MINIMAL | Haiku | Skip (use `--fast`) | Skip | Skip | Skip |
| FULL | Sonnet, Opus 4.5 | Required | Required | 1-3 rounds | Optional |
| LEAN | Opus 4.6+ | Required | Optional | 0-1 rounds | Skip (auto-compact) |

Override: `--tier` flag or `MEOWKIT_HARNESS_MODE`. Density never bypasses gates.

## Hard constraints

- **Budget:** warns at $30 spent, requires explicit approval at $100, hard-blocks at user-set `--budget` value
- **6-hour wall-clock timeout** — hard limit per Anthropic's observed runs; checkpoints every step for resumability
- **Max 3 iteration rounds** between generator and evaluator before escalating to human
- **Run report mandatory** — every run writes full audit trail
- **TDD opt-in:** `--tdd` writes `.claude/session-state/tdd-mode` sentinel; developer waits on tester before each generator iteration

## Outputs

| Artifact | Location |
|---|---|
| Run report | `tasks/harness-runs/YYMMDD-{slug}/run.md` |
| Product plan | `tasks/plans/{plan-dir}/plan.md` |
| Sprint contract | `tasks/contracts/{date}-{slug}-sprint-N.md` |
| Evaluator verdict | `tasks/reviews/{slug}-evalverdict.md` |
| Exit status | PASS \| WARN \| FAIL \| ESCALATED \| TIMED_OUT |
