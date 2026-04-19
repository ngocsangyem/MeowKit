---
name: meow:benchmark
version: 1.0.0
preamble-tier: 3
description: >-
  Use when measuring harness changes against ground truth — runs a small canary
  suite (5 quick tasks, 6 with --full) and records scores in trace-log.jsonl.
  Backs the dead-weight audit with measured deltas. Triggers on /meow:benchmark,
  "run benchmark", "measure harness", or before/after a harness change.
argument-hint: "[run | compare <a> <b>] [--full]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - Agent
source: meowkit
---

# meow:benchmark — Harness Canary Suite

Measures harness performance against a small set of ground-truth tasks. Provides the empirical signal that the dead-weight audit (`docs/dead-weight-audit.md`) consumes to make load-bearing decisions about each harness component.

## Trigger Conditions

Activate when:
- User runs `/meow:benchmark run` (default = quick tier, 5 tasks, ≤$5)
- User runs `/meow:benchmark run --full` (quick tier + 1 heavy task, ≤$30)
- User runs `/meow:benchmark compare <run-id-a> <run-id-b>` (delta table)
- Before applying a harness change (baseline)
- After applying a harness change (verify delta)
- During the dead-weight audit playbook (component enable/disable cycles)

Skip when:
- The harness has been run end-to-end manually within the last hour (use that data instead)
- Budget cap is hit before the suite finishes (record partial result, alert)

## Hard Constraints

1. **Quick tier ≤$5 total cost.** Hard block if projected cost exceeds.
2. **Full tier ≤$30 total cost.** Hard block if projected cost exceeds.
3. **`--full` is opt-in.** The heavy task (`06-small-app-build`) requires explicit `--full` flag because it triggers `meow:harness` which can run for hours. Refuses to run without the flag.
4. **NOT a replacement for unit tests.** This is harness-level measurement only.
5. **Results recorded in trace-log.jsonl** as `event=benchmark_result` records, tagged with `benchmark_version` + `harness_version` + `model_version`.

## Subcommands

| Subcommand | Purpose | Tier | Cost cap |
|---|---|---|---|
| `run` | Execute the quick tier (5 tasks) and record scores | quick | $5 |
| `run --full` | Execute quick + heavy tier (6 tasks total) | full | $30 |
| `compare <a> <b>` | Show per-task delta between two prior runs | — | (free, reads cache) |

## Tier Layout

```
.claude/benchmarks/
├── README.md                                  ← how to use + add tasks
├── canary/
│   ├── quick/                                 ← default tier (5 tasks, ≤$5)
│   │   ├── 01-react-component-spec.md
│   │   ├── 02-api-endpoint-spec.md
│   │   ├── 03-bug-fix-spec.md
│   │   ├── 04-refactor-spec.md
│   │   └── 05-tdd-feature-spec.md
│   └── full/                                  ← --full only (1 task, ~$25)
│       └── 06-small-app-build-spec.md
└── results/                                   ← per-run JSON dumps
```

## Usage

### Run quick tier

```bash
/meow:benchmark run
```

Outputs:
- Per-task verdict + score
- Total cost + duration
- Run ID written to `.claude/benchmarks/results/{run-id}.json` AND trace-log.jsonl

### Run full tier

```bash
/meow:benchmark run --full
```

Same as quick, plus the heavy `06-small-app-build` task. Refuses to run without `--full` to prevent accidental cost burn.

### Compare two runs

```bash
/meow:benchmark compare 260408-1430 260408-1530
```

Outputs a delta table:

```
| Task | Run A score | Run B score | Δ |
|---|---|---|---|
| 01-react-component | 0.92 | 0.88 | -0.04 |
| 02-api-endpoint    | 0.85 | 0.91 | +0.06 |
| 03-bug-fix         | 1.00 | 1.00 |  0.00 |
| ... | ... | ... | ... |
| TOTAL              | 0.89 | 0.91 | +0.02 |
```

## Output Schema

Each benchmark run writes a JSON dump to `.claude/benchmarks/results/{run-id}.json`:

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
    },
    ...
  ],
  "summary": {
    "passed": 4,
    "warned": 1,
    "failed": 0,
    "average_score": 0.89
  }
}
```

## Gotchas

- **`run-canary.sh` is a half-implementation by design.** It writes a manifest with `PENDING` tasks then prints orchestrator instructions. The script CANNOT actually invoke `meow:harness` per task because each invocation requires a fresh subagent context, which only an orchestrator agent can spawn — not a shell process. **The agent invoking this skill MUST follow the printed instructions to fill in each task's results.** Failure to do so leaves the manifest as a stub. Documented in `run-canary.sh:101-115` banner.
- **Circular dependency with `meow:harness`.** This skill invokes `meow:harness` per task. If a harness bug is exactly what the dead-weight audit is trying to find, the audit can fail to even start. Workaround: run individual canary specs manually via `/meow:cook <spec.md>` for the broken-harness case. See `docs/dead-weight-audit.md` § "When the harness is broken".
- **Don't treat 100% pass as "harness is perfect."** Canary tasks are intentionally simple. Real-world failures live in the long tail; canary catches regressions, not all bugs.
- **Don't skip `--full` for the dead-weight audit.** The audit needs the heavy task to detect issues that only manifest in real product builds.
- **Don't compare runs across different model versions** without noting it in the delta table — model upgrade is a confounding variable.
- **Don't auto-rerun on FAIL.** Investigate FAILs manually; rerun only after a code change.

## References

| File | Purpose |
|---|---|
| `scripts/run-canary.sh` | Step 1 of 2: emits a task manifest with PENDING rows for each canary spec. Prints orchestrator instructions for step 2 (spawning per-task harness subagents). The script does NOT invoke `meow:harness` directly — it cannot, because harness requires a fresh subagent context that only the orchestrator can spawn. |
| `scripts/compare-runs.sh` | Reads two prior run JSONs, emits delta table |
| `../../benchmarks/README.md` | How to add new canary tasks |
| `../../benchmarks/canary/` | Spec files |
| `../../benchmarks/results/` | Per-run JSON dumps |
| `../../memory/trace-log.jsonl` | Append-only trace store (benchmark results land here too) |
| `../meow:harness/SKILL.md` | The harness skill that benchmark invokes per spec |
| `../meow:trace-analyze/SKILL.md` | The consumer of benchmark results for the dead-weight audit |

## Start

For run: `scripts/run-canary.sh [--full]`.
For compare: `scripts/compare-runs.sh <run-id-a> <run-id-b>`.

## Memory Write

After each completed benchmark run, append the baseline to `.claude/memory/cost-log.json` (top-level array). Create the file with `[]` if it does not exist.

```json
{"run_id": "{id}", "date": "{ISO-date}", "tier": "quick|full", "pass_rate": N, "avg_score": N, "total_cost_usd": N}
```

Use `mkdir -p .claude/memory` before the append. This persists baselines for `compare-runs.sh` and the dead-weight audit.
