---
title: "mk:benchmark"
description: "Harness canary suite — measures harness performance against ground-truth tasks. Backs the dead-weight audit with measured deltas."
---

# mk:benchmark — Harness Canary Suite

## What This Skill Does

Measures harness performance against a small set of ground-truth tasks. Provides the empirical signal that the dead-weight audit (`docs/dead-weight-audit.md`) consumes to make load-bearing decisions about each harness component.

## When to Use

| Invocation | Tier | Tasks | Cost Cap | Description |
|---|---|---|---|---|
| `/mk:benchmark run` | quick | 5 | ≤$5 | Runs the quick canary suite (default) |
| `/mk:benchmark run --full` | full | 6 | ≤$30 | Quick tier + 1 heavy app-build task |
| `/mk:benchmark compare <a> <b>` | — | — | free (reads cache) | Delta table between two prior runs |

Activate before applying a harness change (baseline) and after (verify delta). Also used during the dead-weight audit playbook for component enable/disable cycles.

**Skip when:** The harness has been run end-to-end manually within the **last hour** (use that data instead), or budget cap would be hit before the suite finishes.

## Core Capabilities

- **Run canary suite:** Executes spec files from `.claude/benchmarks/canary/quick/` (and `full/` with `--full`) via `mk:harness`, recording per-task verdicts, scores, duration, and cost.
- **Compare runs:** Reads two prior run JSONs from `.claude/benchmarks/results/` and emits a markdown delta table showing per-task score and cost changes.
- **Persist baselines:** After each completed run, appends a cost baseline to `.claude/memory/cost-log.json` and emits a `benchmark_result` event to `.claude/memory/trace-log.jsonl`.

## Example Prompt

```
Run the benchmark canary suite to baseline current harness performance. Then compare the results against the last run to see the delta.
```

## Arguments

| Argument | Effect |
|---|---|
| `run` (default) | Execute quick tier (5 tasks, under `.claude/benchmarks/canary/quick/`) |
| `run --full` | Execute quick + heavy tier (6 tasks total, includes `.claude/benchmarks/canary/full/`) |
| `compare <run-id-a> <run-id-b>` | Diff two prior run JSONs |

`--full` is strictly opt-in. The heavy task (`06-small-app-build`) triggers `mk:harness` which can run for hours — the script refuses without the flag to prevent accidental cost burn.

## Hard Constraints

1. **Quick tier ≤$5 total cost.** Hard block if projected cost exceeds.
2. **Full tier ≤$30 total cost.** Hard block if projected cost exceeds.
3. **Results recorded in trace-log.jsonl** as `event=benchmark_result` records, tagged with `benchmark_version` + `harness_version` + `model_version`.
4. **NOT a replacement for unit tests.** Harness-level measurement only.

## Tier Layout
