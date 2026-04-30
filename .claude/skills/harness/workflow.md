# mk:harness — Workflow

7-step workflow (numbered 0–6) orchestrating an autonomous multi-hour build via planner → contract → generator ⇄ evaluator loop with adaptive scaffolding density.

## Rules

- NEVER load multiple step files simultaneously — JIT load one at a time
- ALWAYS halt at iteration cap (`--max-iter`, default 3) — escalate to human, don't loop forever
- ALWAYS write a run report (step-06) even on failure / timeout / escalation
- ALWAYS commit per step — every step's output gets a git commit for resumability
- ALWAYS honor the budget tracker — when `budget-tracker.sh` reports BLOCK, halt immediately
- 6-hour wall-clock hard timeout

### Next-Step Discovery (Critical)

Steps do NOT use `goto` — bash has no goto. Branching is done via the `next_step` variable, which is **persisted to `run.md` frontmatter** so it survives subagent context resets and JIT step loads.

After completing each step, the agent reads the persisted `next_step` field from `$run_dir/run.md` and opens that file:

```bash
next_step=$(grep -E '^next_step:' "$run_dir/run.md" | head -1 | sed -E 's/^next_step:[[:space:]]*//')
# Open and follow $next_step
```

If `next_step` is unset, the agent follows the default linear progression (step-N → step-N+1).

## Steps

0. `step-00-tier-detection.md` — Call `mk:scale-routing` (or `density-select.sh`); pick `MINIMAL|FULL|LEAN`; record decision in run report
1. `step-01-plan.md` — Invoke `mk:plan-creator --product-level` (or `--fast` for MINIMAL); produce product-level spec
2. `step-02-contract.md` — Invoke `mk:sprint-contract propose → review → sign` (skipped on LEAN with small sprint OR MINIMAL)
3. `step-03-generate.md` — Spawn `developer` subagent with the 4-subphase pattern; generator implements per signed contract
4. `step-04-evaluate.md` — Spawn `evaluator` subagent via `mk:evaluate`; produces graded verdict
5. `step-05-iterate-or-ship.md` — Verdict PASS → route to shipper (Phase 5 of the 7-phase model); FAIL → loop back to step-3 with feedback (max `--max-iter` rounds; escalate after)
6. `step-06-run-report.md` — Write the final audit trail at `tasks/harness-runs/{run-id}/run.md`

## Variables Passed Between Steps

| Variable | Set by | Used by | Values |
|---|---|---|---|
| `task_description` | invoker | step-01 | Original natural-language task |
| `density` | step-00 | step-01..05 | `MINIMAL`, `FULL`, `LEAN` |
| `model_id` | step-00 | step-06 | e.g., `opus-4-6`, `sonnet-4-5` |
| `tier` | step-00 | step-06 | `TRIVIAL`, `STANDARD`, `COMPLEX` |
| `run_id` | step-00 | all | `YYMMDD-HHMM-{slug}` |
| `run_dir` | step-00 | all | `tasks/harness-runs/{run_id}/` |
| `plan_dir` | step-01 | step-02..06 | Absolute path to product-level plan dir |
| `slug` | step-01 | step-02..06 | Kebab-case task identifier |
| `contract_path` | step-02 | step-03..06 | Path to signed contract OR `null` (skipped) |
| `handoff_path` | step-03 | step-04..06 | Path to generator handoff file |
| `verdict_path` | step-04 | step-05..06 | Path to evaluator verdict file |
| `verdict` | step-04 | step-05 | `PASS`, `WARN`, `FAIL` |
| `iteration` | step-05 | step-03 (re-entry), step-06 | Integer, 1..max_iter |
| `max_iter` | invoker / default 3 | step-05 | Integer |
| `budget_cap` | invoker / default 50 | step-03..05 | USD |
| `budget_spent` | running tally | step-06 | USD |
| `final_status` | step-05 | step-06 | `PASS`, `WARN`, `FAIL`, `ESCALATED`, `TIMED_OUT` |
| `next_step` | step-03/04/05 | JIT loader | filename of next step file to read; persisted to run.md frontmatter so it survives subagent context resets |

## Flow

```
/mk:harness "build a kanban app" [--tier auto|full|lean|minimal] [--max-iter 3] [--budget 50]
    ↓
Step 0: Tier Detection
    ├── density-select.sh OR mk:scale-routing
    ├── env override: MEOWKIT_HARNESS_MODE
    ├── --tier flag override
    └── Create tasks/harness-runs/{run_id}/
         ↓
Step 1: Plan
    ├── mk:plan-creator --product-level
    ├── (MINIMAL → --fast instead)
    └── Output: tasks/plans/{plan_dir}/plan.md
         ↓
Step 2: Contract (conditional)
    ├── If density == MINIMAL → SKIP entirely
    ├── If density == LEAN AND sprint criteria < 5 → SKIP (single-pass build)
    ├── Otherwise: mk:sprint-contract propose → review → sign
    └── Output: tasks/contracts/{contract_path}.md
         ↓
Step 3: Generate
    ├── Spawn developer subagent
    ├── Pass: signed contract path + 4-subphase pattern instruction
    ├── Developer runs understand → design → implement → verify → handoff
    └── Output: tasks/handoff/{slug}-sprint-{N}.md
         ↓
Step 4: Evaluate
    ├── Invoke mk:evaluate <handoff> --rubric-preset {detected}
    ├── Active verification gate enforced
    └── Output: tasks/reviews/{slug}-evalverdict.md + verdict (PASS|WARN|FAIL)
         ↓
Step 5: Iterate or Ship
    ├── PASS → route to shipper, set final_status=PASS, go to step-06
    ├── WARN + iteration < max_iter → loop to step-3 with feedback
    ├── FAIL + iteration < max_iter → loop to step-3 with feedback
    ├── iteration == max_iter → escalate to human via AskUserQuestion
    └── budget breach OR 6h timeout → halt, set final_status=TIMED_OUT
         ↓
Step 6: Run Report
    ├── Aggregate per-step artifacts + budget trail + density decision
    ├── Write tasks/harness-runs/{run_id}/run.md
    └── Print summary to user
```

## Mode Notes

- **MINIMAL** (Haiku/trivial): Runs `mk:cook` instead of the full harness. No contract, no iteration loop. Cheapest path.
- **FULL** (Sonnet/Opus 4.5): Standard pipeline. Contract required. 1–3 iteration rounds.
- **LEAN** (Opus 4.6+): Single-session build. Contract optional. 0–1 iteration rounds. Trusts the model's adaptive reasoning.

## Resume

If a run is killed mid-flight, resume via `/mk:harness --resume {run_id}`. The orchestrator reads `run.md` to find the last completed step and continues from there. Run reports are append-only — no step is re-executed.

## Next

Read and follow `step-00-tier-detection.md`.
