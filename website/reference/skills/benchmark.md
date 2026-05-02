---
title: "mk:benchmark"
description: "Harness canary suite — measures harness performance against ground-truth tasks. Backs dead-weight audit with measured deltas."
---

# mk:benchmark

Measures harness performance against ground-truth tasks. Provides the empirical signal for the dead-weight audit (`docs/dead-weight-audit.md`).

## When to use

- `/mk:benchmark run` — quick tier (5 tasks, ≤$5)
- `/mk:benchmark run --full` — full tier (quick + 1 heavy task, ≤$30)
- `/mk:benchmark compare <a> <b>` — delta table between runs
- Before applying harness change (baseline), after (verify delta)

Skip when: last run <24h ago with no harness changes, budget cap <$5 for quick or <$30 for full.

## Output

Results written to `.claude/benchmarks/results/{run-id}.json` and appended to `.claude/memory/trace-log.jsonl` as `benchmark_result` events.

## Usage

```bash
/mk:benchmark run              # Quick tier (5 tasks)
/mk:benchmark run --full       # Full tier (6 tasks)
/mk:benchmark compare abc def  # Delta table
```
