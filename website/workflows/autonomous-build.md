---
title: "Autonomous Green-Field Build"
description: "Use mk:harness to build a green-field product end-to-end with generator/evaluator loop and adaptive scaffolding."
persona: B
---

# Autonomous Green-Field Build

> `/mk:harness` orchestrates a full product build autonomously — planner → contract → generator ⇄ evaluator loop → ship.

**Best for:** Green-field product builds ("build me a X")  
**Time estimate:** 30–180 minutes (multi-hour autonomous runs supported)  
**Skills used:** [mk:harness](/reference/skills/harness), [mk:sprint-contract](/reference/skills/sprint-contract), [mk:evaluate](/reference/skills/evaluate), [mk:rubric](/reference/skills/rubric)

## When to Use

Use `/mk:harness` when you want to build a new product or substantial green-field system autonomously:

- "Build me a kanban app with drag/drop and user auth"
- "Create a time-tracking CLI with SQLite storage"
- "Scaffold a REST API with authentication and tests"

**Not for:**
- Single features on an existing codebase → use `/mk:cook`
- Bug fixes or refactors → use `/mk:fix`
- Architecture exploration → use `/mk:party`

## What You Get

- **Adaptive scaffolding** — density (MINIMAL / FULL / LEAN) auto-selected per model tier; no manual setup
- **Generator/evaluator separation** — developer agent builds; evaluator agent grades the running build from a fresh context, preventing self-eval bias
- **Weighted rubric verdict** — each criterion scored independently; hard-fail propagation means one broken dimension fails the sprint
- **Full audit trail** — run report, contract, evidence directory, and evaluator verdict all written to `tasks/`

## Prerequisites

- Opus 4.5+ recommended (Sonnet works with FULL density, Haiku short-circuits to `mk:cook`)
- If on Opus 4.6+, set `export MEOWKIT_MODEL_HINT=opus-4-6` before starting Claude Code — enables LEAN auto-detect
- Budget awareness: use `--budget 50` or `export MEOWKIT_BUDGET_CAP=50` for long runs
- MeowKit v2.2.0+ installed (`npx mewkit doctor` to verify)

## Quick Start

```bash
/mk:harness "build a kanban app"
```

That's it. The harness reads `MEOWKIT_MODEL_HINT`, selects density, and runs the full pipeline.

## Worked Example: Kanban App

This walks through what actually happens when you run:

```
/mk:harness "build a kanban app with drag/drop cards and user auth"
```

### Step 0 — Density Auto-Select

The harness reads `MEOWKIT_MODEL_HINT` and the model tier:

```
mk:harness: model hint = opus-4-6 → tier = COMPLEX → density = LEAN
Scaffolding: single-session, contract optional, 0–1 evaluator iterations
Run ID: harness-260408-1423-kanban
```

On Sonnet (no hint set): density = FULL (contract required, up to 3 iterations).

### Step 1 — Product-Level Plan

The **planner** agent runs in `--product-level` mode. It emits user stories and design language — NOT file paths or class names:

```
Plan: Kanban App
  User stories:
  - As a user, I can create boards and add named lists to them
  - As a user, I can drag cards between lists to update status
  - As a user, I can sign in with email/password to save my boards
  Design language: clean utility-first UI, dark mode, smooth drag feedback
```

Gate 1 fires — you review and approve the product spec.

### Step 2 — Sprint Contract (FULL density only)

The **sprint-contract** skill drafts acceptance criteria tied to evaluator rubrics:

```
Contract: harness-260408-1423-kanban-sprint-1.md
  AC-1: Board CRUD — create, rename, delete boards (→ functionality rubric)
  AC-2: Card drag/drop — reorder within list and move between lists (→ functionality)
  AC-3: Auth flow — sign up, sign in, sign out, persist session (→ functionality)
  AC-4: UI quality — no broken layouts, consistent spacing (→ design-quality)
Signed. Gate enforced by gate-enforcement.sh.
```

In LEAN mode this step is skipped if estimated ACs < 5.

### Step 3 — Generator Build

The **developer** agent builds in 4 subphases. It cannot read the contract evaluator results — context is fresh per harness-rules.md Rule 2:

```
Subphase 1 — Project setup (Vite + React + Tailwind + Pinia)
Subphase 2 — Data model (Board, List, Card stores; SQLite via Drizzle)
Subphase 3 — UI (BoardView, ListColumn, CardItem with @dnd-kit/core drag)
Subphase 4 — Auth (JWT login/signup, protected routes)
Tests: 31/31 passing ✓
```

### Step 4 — Evaluator Verdict

The **evaluator** agent starts with a fresh context and the `frontend-app` rubric preset (4 rubrics: `product-depth`, `functionality`, `design-quality`, `originality`). It drives the running build directly:

```
Active verification:
  → browser: open http://localhost:5173
  → click "Create board" → board appears ✓
  → drag card from "Todo" to "In Progress" → card moves ✓
  → sign up → session persists on reload ✓
  → screenshot evidence written to evidence/kanban-260408/

Rubric scores:
  product-depth:    0.82  PASS
  functionality:    0.91  PASS
  design-quality:   0.74  PASS
  originality:      0.68  PASS (no anti-patterns detected)
  Weighted overall: 0.81  → PASS
```

The skeptic persona is re-anchored before each rubric to prevent leniency drift.

### Step 5 — Iterate or Ship

PASS on first round → proceed to ship. On FAIL, the loop re-runs up to 3 times (configurable via `--max-iter`). After 3 consecutive FAILs, the harness escalates to human via `AskUserQuestion`.

### Step 6 — Artifacts

```
tasks/harness-runs/harness-260408-1423-kanban/run.md     ← full run report
tasks/contracts/260408-kanban-sprint-1.md                ← signed contract (FULL only)
tasks/reviews/260408-kanban-evalverdict.md               ← evaluator verdict + scores
evidence/kanban-260408/                                  ← screenshots + curl output
```

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--tier MINIMAL\|FULL\|LEAN` | auto | Override scaffolding density |
| `--max-iter N` | 3 | Max generator ⇄ evaluator rounds before escalation |
| `--budget N` | 100 | Hard budget cap in USD |
| `--no-boot` | off | Skip project scaffolding (use existing repo) |
| `--teams` | off | Spawn parallel developer agents (COMPLEX only) |
| `--resume RUN_ID` | — | Resume interrupted run from last checkpoint |

## Reading the Verdict

The verdict file (`tasks/reviews/*-evalverdict.md`) contains:

- **Per-rubric weighted scores** — each rubric graded independently against its anchors
- **Overall weighted score** — sum of (rubric weight × rubric score)
- **Hard-fail propagation** — any single rubric FAIL sets overall verdict to FAIL regardless of score (harness-rules.md Rule 3)
- **Evidence directory** — screenshots, curl output, CLI logs used for grading

A score ≥ 0.70 per rubric is PASS. Hard-fail threshold is configurable per rubric in `.claude/rubrics/`.

## Troubleshooting

**"Density auto-detected as FULL but I'm on Opus 4.6"**  
Claude Code does not export model env vars to hooks. Set `export MEOWKIT_MODEL_HINT=opus-4-6` in your shell before running `claude`. Then restart Claude Code. Without the hint, Opus 4.6 silently gets FULL density.

**"Budget breach at iteration 2"**  
Pass a lower cap: `/mk:harness "..." --budget 30`. Or re-scope the product spec to fewer features — the planner's product-level output drives total work. `/mk:harness --no-boot` on an existing scaffold also reduces Phase 3 cost.

**"Evaluator returned FAIL but the build looks fine to me"**  
Open the evidence directory — the evaluator writes screenshots and curl output for every graded AC. Use `/mk:elicit` to re-examine a specific rubric with deeper elicitation methods. If the rubric anchors are miscalibrated for your project, see `.claude/rubrics/calibration-guide.md`.

**"Run interrupted mid-build"**  
The harness checkpoints state to `tasks/harness-runs/{run-id}/run.md`. Resume with: `/mk:harness --resume harness-260408-1423-kanban`.

## Related

- [Harness Architecture](/guide/harness-architecture) — how the generator/evaluator pipeline works
- [Adaptive Density](/guide/adaptive-density) — full density decision matrix and dead-weight thesis
- [mk:harness reference](/reference/skills/harness) — all flags and configuration
- [mk:evaluate reference](/reference/skills/evaluate) — evaluator rubric grading detail
- Canonical runbook: `docs/harness-runbook.md`
