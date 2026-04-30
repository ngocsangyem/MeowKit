---
title: "mk:harness"
description: "Autonomous multi-hour build pipeline for green-field products — orchestrates planner, contract, generator/evaluator loop with adaptive scaffolding density per model tier."
---

# mk:harness

Autonomous multi-hour build pipeline for green-field products. `mk:harness` is the entry point for "build me an app" scope — distinct from [`mk:cook`](/reference/skills/cook), which handles single features. It orchestrates a planner → contract → generator ⇄ evaluator loop with scaffolding density automatically tuned to the detected model tier.

## What This Skill Does

`mk:harness` takes a green-field product description and drives the full build pipeline without manual handholding. It detects your model tier, selects the right scaffolding density (MINIMAL / FULL / LEAN), runs a product-level planner, optionally negotiates a sprint contract, dispatches a generator (developer) subagent, and then hands off to an evaluator for behavioral grading. If the evaluator returns FAIL, the harness loops back to the generator — up to 3 rounds before escalating to a human. Every run produces an append-only audit report in `tasks/harness-runs/`.

## Core Capabilities

- **Adaptive density selection** — auto-picks MINIMAL / FULL / LEAN via `mk:scale-routing` based on model tier; honoring `MEOWKIT_HARNESS_MODE` override
- **Step-file workflow** — 7 steps load one at a time (JIT); supports mid-run resumability via `--resume {run-id}`
- **Generator/evaluator separation** — generator and evaluator are distinct subagents with isolated contexts (no self-evaluation)
- **Budget enforcement** — warns at $30, hard-blocks at $100, supports user-set `--budget` cap
- **Iteration cap** — 3 generator/evaluator rounds by default (configurable via `--max-iter`); escalates to human after cap
- **Run report** — every run writes `tasks/harness-runs/YYMMDD-{slug}/run.md` with full per-step audit trail
- **Gate compliance** — density choices never bypass Gate 1 (plan) or Gate 2 (review); all gates still apply

## When to Use This

::: tip Use mk:harness when...
- You're building a green-field product from scratch ("build me a kanban app", "build a retro game maker")
- You want an autonomous multi-hour build with minimal handholding
- You need the full planner → contract → evaluate pipeline
- You want scaffolding density automatically tuned to your model tier
:::

::: warning Don't use mk:harness when...
- The task is a single feature, bug fix, or refactor — use [`mk:cook`](/reference/skills/cook) instead
- The task is a doc update or code review — use the targeted single-shot skills
- You just want to explain or review something — harness is for building, not analysis
:::

## Usage

```bash
# Natural language green-field build
/mk:harness build a kanban board with drag-and-drop

# Explicit full tier (forces FULL density regardless of model)
/mk:harness build a todo app --tier full

# Lean mode for capable models (Opus 4.6+)
/mk:harness build a retro game maker --tier lean

# Cap budget at $25 and limit iterations
/mk:harness build a markdown editor --budget 25 --max-iter 2

# Resume a previous run at the last completed step
/mk:harness --resume 260408-1450-build-todo
```

## Inputs

- Green-field product description (natural language string or spec file path)
- `--tier auto|full|lean|minimal` — override adaptive density detection
- `--max-iter N` — maximum generator/evaluator iteration rounds (default 3)
- `--budget USD` — user-set hard cost cap (overrides the $100 default)
- `MEOWKIT_HARNESS_MODE` env var — project-level density override
- `MEOWKIT_MODEL_HINT` env var — required for Opus 4.6+ auto-detection (see Gotchas)

## Outputs

- `tasks/harness-runs/YYMMDD-{slug}/run.md` — append-only audit trail per step
- `tasks/plans/{plan-dir}/plan.md` — product-level plan (step 1)
- `tasks/contracts/{date}-{slug}-sprint-{N}.md` — signed sprint contract (step 2, FULL only)
- `tasks/reviews/{slug}-evalverdict.md` — evaluator verdict (step 4)
- Exit status: `PASS | WARN | FAIL | ESCALATED | TIMED_OUT`

## Flags

| Flag | Purpose | Default |
|------|---------|---------|
| `--tier auto\|full\|lean\|minimal` | Override adaptive density selection | `auto` |
| `--max-iter N` | Max generator/evaluator loop rounds | `3` |
| `--budget USD` | Hard cost cap (USD) | `100` |
| `--resume {run-id}` | Resume at last completed step | — |
| `--full` | Alias for `--tier full` | — |

## How It Works

### Step 0 — Tier Detection

Calls `mk:scale-routing` (or `density-select.sh`) to determine model tier and select density (MINIMAL/FULL/LEAN). Checks `MEOWKIT_HARNESS_MODE` env var first as an override. Logs the decision to the run report.

### Step 1 — Plan

Invokes `mk:plan-creator --product-level`. The planner produces user stories and acceptance criteria — NOT file paths or class names. The plan must pass Gate 1 (human approval) before the build begins.

### Step 2 — Contract

Invokes `mk:sprint-contract propose → review → amend → sign`. Required in FULL density. Optional in LEAN (skipped when estimated ACs < 5). Skipped entirely in MINIMAL. The signed contract is the source of truth for what the generator builds.

### Step 3 — Generate

Dispatches a developer subagent with the signed contract and product spec. The generator works through a 4-subphase pattern (orient → test-red → build-green → verify). Uses isolated context — the generator never reads evaluator output directly.

### Step 4 — Evaluate

Invokes `mk:evaluate` with the running build artifact. The evaluator drives the app via browser/curl/CLI, grades against the rubric preset, and produces a verdict with concrete evidence. PASS without evidence is rejected by `validate-verdict.sh`.

### Steps 5–6 — Iterate or Ship, Run Report

If FAIL: loops back to step 3 (up to `--max-iter` rounds). If PASS: hands off to the shipper agent. Step 6 writes the final run report regardless of outcome.

## Relationships

- [`mk:sprint-contract`](/reference/skills/sprint-contract) — step 2; negotiates testable ACs before the generator touches code
- [`mk:evaluate`](/reference/skills/evaluate) — step 4; behavioral grader that drives the running build
- [`mk:rubric`](/reference/skills/rubric) — provides the rubric presets that evaluate grades against
- [`mk:cook`](/reference/skills/cook) — sibling pipeline for single features; harness is for green-field products
- [Evaluator agent](/reference/agents/evaluator) — the subagent persona that `mk:evaluate` orchestrates
- [Harness rules](/reference/rules-index#harness-rules) — governing rules: iteration cap, contract gate, active-verification HARD GATE, budget thresholds
- [Adaptive density guide](/guide/adaptive-density) — full decision matrix per tier × model
- [Harness architecture guide](/guide/harness-architecture) — end-to-end pipeline explanation

## See Also

- Canonical source: `.claude/skills/harness/SKILL.md`
- Adaptive density matrix: `.claude/skills/harness/references/adaptive-density-matrix.md`
- Harness runbook: `docs/harness-runbook.md`
- Related guides: [/guide/harness-architecture](/guide/harness-architecture), [/guide/adaptive-density](/guide/adaptive-density)
