# /mk:autobuild — Autonomous Product-Build Pipeline

## Usage

```
/mk:autobuild [product description]
/mk:autobuild --resume [run-id]
/mk:autobuild --tier [MINIMAL|FULL|LEAN]
/mk:autobuild --budget [amount-usd]
/mk:autobuild --max-iter [N]
```

## Behavior

Runs `mk:autobuild` skill — the autonomous generator/evaluator build pipeline for green-field products. Preferred over `/mk:cook` for product-level builds ("build me a kanban app").

Adaptive scaffolding density per model tier:
- **MINIMAL** (Haiku) — short-circuits to `/mk:cook`
- **FULL** (Sonnet, Opus 4.5) — contract + 1–3 iterations + context resets
- **LEAN** (Opus 4.6+) — single-session, contract optional

### Execution Steps

1. **Tier detection** — detect model, select density
2. **Plan** — product-level spec via `mk:plan-creator --product-level`
3. **Contract** — negotiate sprint contract (FULL density) or skip (LEAN/MINIMAL)
4. **Generate** — developer builds per contract/spec
5. **Evaluate** — evaluator grades running build against rubric criteria
6. **Iterate or ship** — loop (max 3 rounds) or ship if passing
7. **Run report** — final report with metrics

### Flags

| Flag | Behavior |
|------|----------|
| `--resume` | Resume a previous autobuild run from last checkpoint |
| `--tier` | Override auto-detected density (MINIMAL/FULL/LEAN) |
| `--budget` | Set session budget cap in USD (overrides $100 default) |
| `--max-iter` | Override iteration cap (default: 3) |

### Output

- Product build with passing evaluator verdict
- Run report at `tasks/autobuild-runs/`
- Budget tracking in `session-state/budget-state.json`
