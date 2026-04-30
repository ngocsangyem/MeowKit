---
title: "mk:benchmark"
description: "Harness canary suite — runs a small set of ground-truth tasks to measure harness performance and back dead-weight audit decisions with empirical deltas."
---

# mk:benchmark

Measures harness performance against a curated set of ground-truth tasks. Provides the empirical signal that the dead-weight audit (`docs/dead-weight-audit.md`) consumes to make load-bearing decisions about each harness component. Results land in `trace-log.jsonl` as `benchmark_result` events, tagged with `benchmark_version`, `harness_version`, and `model_version`.

## What This Skill Does

`mk:benchmark` runs a small canary suite — 5 quick tasks by default, or 6 with `--full` — against the current harness configuration and records per-task scores. The `compare` subcommand produces a delta table between two prior runs, making before/after harness changes directly measurable. This is how the dead-weight audit answers "is this harness component still load-bearing?" — by running the suite before a change, applying the change, and running again. The `--full` flag is required to include the heavy app-build task that can run for hours; omitting it prevents accidental cost burn.

## Core Capabilities

- **3 subcommands** — `run`, `run --full`, `compare <run-id-a> <run-id-b>`
- **Two cost tiers** — quick tier ≤$5 (5 tasks), full tier ≤$30 (6 tasks); hard-blocked if projected cost exceeds
- **`--full` opt-in gate** — the heavy `06-small-app-build` task requires explicit `--full` to prevent accidental multi-hour runs
- **Trace integration** — results written to both `.claude/benchmarks/results/{run-id}.json` and `trace-log.jsonl` for `mk:trace-analyze` consumption
- **Delta comparison** — `compare` reads two prior run JSONs and emits a per-task score delta table
- **Dead-weight audit backing** — the canonical measurement mechanism per `docs/dead-weight-audit.md`

## When to Use This

::: tip Use mk:benchmark when...
- You're about to apply a harness change and need a baseline measurement first
- You've applied a harness change and want to verify the delta
- A model upgrade requires validating that existing scaffolding is still load-bearing
- The dead-weight audit playbook calls for a calibration replay
- You want empirical evidence before promoting or demoting a density tier in the adaptive density matrix
:::

::: warning Don't use mk:benchmark when...
- The harness has been run end-to-end manually within the last hour — use that data instead
- You're looking for unit-test coverage — this is harness-level measurement only, not a test suite replacement
- You want to analyze patterns across multiple runs — use [`mk:trace-analyze`](/reference/skills/trace-analyze) for that
- Budget cap would be hit before the suite finishes — record partial result, alert, and investigate
:::

## Usage

```bash
# Run the quick tier (5 tasks, ≤$5)
/mk:benchmark run

# Run the full tier (6 tasks including the heavy app build, ≤$30)
/mk:benchmark run --full

# Compare two prior runs — shows per-task delta table
/mk:benchmark compare 260408-1430 260408-1530
```

## Subcommands

| Subcommand | Purpose | Tier | Cost Cap |
|---|---|---|---|
| `run` | Execute quick tier (5 tasks) and record scores | quick | $5 |
| `run --full` | Execute quick + heavy tier (6 tasks total) | full | $30 |
| `compare <a> <b>` | Delta table between two prior runs | — | free (reads cache) |

## Tier Layout

```
.claude/benchmarks/
├── README.md                          ← how to use + add canary tasks
├── canary/
│   ├── quick/                         ← default tier (5 tasks, ≤$5)
│   │   ├── 01-react-component-spec.md
│   │   ├── 02-api-endpoint-spec.md
│   │   ├── 03-bug-fix-spec.md
│   │   ├── 04-refactor-spec.md
│   │   └── 05-tdd-feature-spec.md
│   └── full/                          ← --full only (~$25 per run)
│       └── 06-small-app-build-spec.md
└── results/                           ← per-run JSON dumps
```

## Inputs

- `--full` flag — enables the heavy `06-small-app-build` task
- `.claude/benchmarks/canary/` — spec files consumed by `run-canary.sh`
- `run-id-a`, `run-id-b` — run IDs for `compare` (reads from `.claude/benchmarks/results/`)
- Current harness version (recorded in result JSON as `harness_version`)
- `MEOWKIT_MODEL_HINT` — model version recorded in result JSON for cross-model delta analysis

## Outputs

Per `run`:
- `.claude/benchmarks/results/{run-id}.json` — full result JSON with per-task scores, costs, durations
- `.claude/memory/trace-log.jsonl` — appended `benchmark_result` events (consumed by `mk:trace-analyze`)
- Printed: per-task verdict + score, total cost, total duration, run ID

Per `compare`:
- Printed delta table (no files written — reads from cached result JSONs)

## Output Schema

```json
{
  "run_id": "260408-1430-bench",
  "tier": "quick",
  "started": "2026-04-08T14:30:00Z",
  "ended": "2026-04-08T14:42:00Z",
  "harness_version": "3.0.0",
  "model": "claude-opus-4-6",
  "total_cost_usd": 4.20,
  "total_duration_seconds": 720,
  "tasks": [
    {
      "spec": "01-react-component-spec.md",
      "verdict": "PASS",
      "weighted_score": 0.92,
      "duration_seconds": 145,
      "cost_usd": 0.85,
      "rubric_preset": "frontend-app"
    }
  ],
  "summary": {
    "passed": 4,
    "warned": 1,
    "failed": 0,
    "average_score": 0.89
  }
}
```

## Flags

| Flag | Purpose | Default |
|---|---|---|
| `--full` | Include the heavy `06-small-app-build` task | off (opt-in) |
| `<run-id-a> <run-id-b>` | Run IDs for `compare` subcommand | — |

## How It Works

### `run` — Canary Execution

`run-canary.sh` iterates spec files in the active tier, writes a manifest with `PENDING` tasks, then prints orchestrator instructions. The agent invoking this skill must follow those instructions to fill in each task's results — the shell script cannot spawn `mk:harness` subagents directly. Each task invokes `mk:harness` with the spec as input. Results are recorded back to the manifest and then flushed to the result JSON and `trace-log.jsonl`.

### `compare` — Delta Table

`compare-runs.sh` reads two prior result JSONs, aligns tasks by spec filename, and emits a per-task delta table. No new harness runs are triggered. The delta is the primary signal for dead-weight audit decisions: a component is load-bearing if removing it produces a negative delta; it is dead weight if removing it produces a neutral or positive delta.

## Hard Constraints

From `mk:benchmark` source:
1. Quick tier ≤$5 total cost; hard block if projected cost exceeds
2. Full tier ≤$30 total cost; hard block if projected cost exceeds
3. `--full` is opt-in — heavy task requires explicit flag; refuses without it
4. Not a replacement for unit tests — harness-level measurement only
5. Results tagged with `benchmark_version` + `harness_version` + `model_version` for traceability

## Gotchas

1. **`run-canary.sh` is a half-implementation by design** — it writes a manifest with `PENDING` tasks then prints orchestrator instructions; the agent MUST follow those instructions manually. Shell processes cannot spawn `mk:harness` subagents. Documented in `run-canary.sh:101-115`
2. **Circular dependency with `mk:harness`** — this skill invokes `mk:harness` per task; if a harness bug is exactly what the dead-weight audit is trying to find, the audit may fail to start. Workaround: run individual canary specs manually via `/mk:cook <spec.md>` for the broken-harness case
3. **Don't treat 100% pass as "harness is perfect"** — canary tasks are intentionally simple; they catch regressions, not the full tail of real-world failures
4. **Don't skip `--full` for the dead-weight audit** — the heavy task is needed to detect issues that only manifest in real product builds
5. **Don't compare runs across different model versions** without noting it in the delta table — model upgrade is a confounding variable that must be declared
6. **Don't auto-rerun on FAIL** — investigate FAILs manually; rerun only after a code change

## Relationships

- [`mk:harness`](/reference/skills/harness) — benchmark invokes `mk:harness` per canary spec task
- [`mk:trace-analyze`](/reference/skills/trace-analyze) — consumes benchmark result records from `trace-log.jsonl` for the dead-weight audit
- [`mk:evaluate`](/reference/skills/evaluate) — each harness invocation uses `mk:evaluate` to grade the canary build; rubric scores flow into the result JSON
- [`/reference/agents/evaluator`](/reference/agents/evaluator) — evaluator agent grading each canary task

## See Also

- Canonical source: `.claude/skills/benchmark/SKILL.md`
- Canary spec directory: `.claude/benchmarks/canary/`
- Canary runner: `.claude/skills/benchmark/scripts/run-canary.sh`
- Compare script: `.claude/skills/benchmark/scripts/compare-runs.sh`
- Dead-weight audit playbook: `docs/dead-weight-audit.md`
- Related guide: [`/guide/trace-and-benchmark`](/guide/trace-and-benchmark)
- Related skill: [`mk:trace-analyze`](/reference/skills/trace-analyze)
