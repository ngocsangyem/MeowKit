---
title: Autonomous Build
description: Green-field product builds with /mk:harness — planner, sprint contract, generator/evaluator loop with adaptive density.
---

# Autonomous Build

`/mk:harness` builds entire products from a description. It's for "build me a kanban app" scope — not single features (use `/mk:cook` for those). It runs a planner → contract → generator ⇄ evaluator loop with minimal handholding.

## Quick start

```bash
/mk:harness build a kanban board with drag-and-drop
```

MeowKit detects your model tier, selects the right scaffolding density, and drives the full build. You approve at Gate 1 (plan) and Gate 2 (review). The evaluator grades the running app against rubrics. If it fails, the harness loops back to the generator — up to 3 rounds.

## When to use

| Situation | Use |
|-----------|-----|
| Green-field product from scratch | `/mk:harness` |
| Single feature on existing codebase | `/mk:cook` |
| Bug fix | `/mk:fix` |

## Scaffolding density

The harness adjusts automatically based on your model tier:

| Model | Density | What runs |
|-------|---------|-----------|
| Haiku | MINIMAL | Short-circuits to `/mk:cook` |
| Sonnet | FULL | Sprint contract + 1-3 iteration rounds |
| Opus 4.5 | FULL | Contract + full pipeline |
| Opus 4.6+ | LEAN | Single-session, contract optional, 0-1 rounds |

Override with `--tier` or `MEOWKIT_HARNESS_MODE`:

```bash
/mk:harness build a todo app --tier full     # Force FULL density
/mk:harness build a retro game maker --tier lean  # Force LEAN
```

## Budget control

```bash
/mk:harness build a markdown editor --budget 25 --max-iter 2
```

- Default budget: $100 hard cap (warns at $30)
- `--budget N` overrides the cap
- `--max-iter N` limits generator/evaluator rounds (default 3)

## What gets produced

| Artifact | Location |
|----------|----------|
| Product plan | `tasks/plans/{slug}/plan.md` |
| Sprint contract | `tasks/contracts/{date}-{slug}-sprint-N.md` |
| Evaluator verdict | `tasks/reviews/{slug}-evalverdict.md` |
| Full audit trail | `tasks/harness-runs/YYMMDD-{slug}/run.md` |

## Resuming after interruption

```bash
/mk:harness --resume 260501-1450-build-kanban
```

Picks up at the last completed step. Run reports are append-only — no work is lost.

## Exit statuses

| Status | Meaning |
|--------|---------|
| PASS | Evaluator graded the build as passing |
| WARN | Minor issues found, build is acceptable |
| FAIL | Evaluator rejected the build after 3 iterations |
| ESCALATED | Human intervention required |
| TIMED_OUT | Budget cap reached |

## Don't use /mk:harness for

- **Single features or bug fixes** — use `/mk:cook` or `/mk:fix`
- **Doc updates or code reviews** — use targeted skills
- **Analysis or explanation** — harness is for building, not research

## Next steps

- [Build a feature](/guides/build-a-feature) — the single-feature pipeline
- [Adaptive density](/guide/adaptive-density) — the dead-weight thesis in detail
- [Trace & benchmark](/guide/trace-and-benchmark) — measuring harness performance
