# MeowKit Benchmark Suite

Canary tasks that measure the harness's ground-truth performance. Backs the dead-weight audit (`docs/dead-weight-audit.md`) with empirical signal.

## What This Is

A small set of self-contained tasks (5 quick + 1 heavy) that exercise different harness dimensions. NOT a unit test suite. NOT a comprehensive benchmark. The point is **regression detection** when harness components change — not full coverage.

## Tiers

| Tier | Tasks | Cost cap | Use when |
|---|---|---|---|
| **quick** (default) | 5 | ≤$5 | Day-to-day regression check; before/after a hook change |
| **full** (`--full`) | 6 (quick + heavy) | ≤$30 | Dead-weight audit; major harness release; quarterly check |

The heavy task (`06-small-app-build`) requires explicit `--full` because it triggers `meow:harness` which can run for 60–90 minutes.

## Running

```bash
# Quick tier (default)
/meow:benchmark run

# Full tier (opt-in only)
/meow:benchmark run --full

# Compare two prior runs
/meow:benchmark compare 260408-1430-bench 260408-1530-bench
```

Results land in `.claude/benchmarks/results/{run-id}.json` AND as a `benchmark_result` record in `.claude/memory/trace-log.jsonl`.

## Spec File Format

Each canary task is a markdown file under `canary/quick/` or `canary/full/` with frontmatter:

```yaml
---
benchmark_task: <kebab-case-id>
tier: quick | full
target_seconds: <int>
target_cost_usd: <float>
rubric_preset: frontend-app | backend-api | cli-tool | fullstack-product
---

# Task: <human-readable title>

<product spec / instructions for the harness>

## Acceptance Criteria
- [ ] <binary check>
- [ ] <binary check>

## Notes
<rationale: what dimension this task exercises>
```

## Adding a New Canary Task

1. Identify a regression mode you want to catch (e.g., "harness fails on Vue components" → add a Vue canary)
2. Write the smallest possible task that exercises it
3. Set realistic `target_seconds` and `target_cost_usd` based on prior runs
4. Drop the spec into `canary/quick/` or `canary/full/`
5. Run `/meow:benchmark run` once to establish a baseline
6. Document the task's purpose in this README

## What's NOT Covered

- **Real-world complexity** — these tasks are intentionally tiny. A passing canary doesn't mean the harness handles a 50-feature production app.
- **All languages** — currently TypeScript-heavy. Add Python/Go/Rust canaries when those become primary failure modes.
- **All rubric dimensions** — quick tier covers product-depth + functionality + code-quality. Design quality + originality only meaningfully exercised in `06-small-app-build`.
- **Subjective taste** — rubrics catch ~80% of "AI slop" via anti-patterns; the long tail of subjective taste isn't measurable here.

## Files

```
.claude/benchmarks/
├── README.md                                   ← this file
├── canary/
│   ├── quick/
│   │   ├── 01-react-component-spec.md          ← React component, ~90s, ~$0.80
│   │   ├── 02-api-endpoint-spec.md             ← Express route, ~120s, ~$1.00
│   │   ├── 03-bug-fix-spec.md                  ← Off-by-one fix, ~60s, ~$0.40
│   │   ├── 04-refactor-spec.md                 ← Extract helper, ~90s, ~$0.60
│   │   └── 05-tdd-feature-spec.md              ← TDD slugify, ~150s, ~$1.20
│   └── full/
│       └── 06-small-app-build-spec.md          ← Notes app E2E, ~90min, ~$25
├── results/                                    ← per-run JSON dumps
│   └── .gitkeep
└── (see .claude/skills/meow:benchmark/ for the runner)
```

## Cost Budget

- Quick tier total: ~$4.00 (5 tasks; cap $5)
- Full tier total: ~$29.00 (6 tasks; cap $30; the heavy task dominates)

## Trace Integration

Each benchmark run appends a `benchmark_result` record to `.claude/memory/trace-log.jsonl`. `meow:trace-analyze` consumes these for the dead-weight audit's measured-delta column.

## See Also

- `.claude/skills/meow:benchmark/SKILL.md` — runner skill
- `.claude/skills/meow:trace-analyze/` — consumer of benchmark results
- `docs/dead-weight-audit.md` — recurring playbook that depends on this suite
