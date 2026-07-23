---
name: "autobuild"
description: "Use when running an autonomous multi-hour build of a green-field product — orchestrates planner → contract → generator ⇄ evaluator loop with adaptive scaffolding density per model tier. Triggers on the autobuild skill, \"build me a kanban app\", \"build a retro game maker\", \"autonomous build\", or any green-field product spec. NOT for scoped single-task work (see mk:cook); NOT for initial project scaffolding only (see mk:bootstrap)."
---

<!-- Lifecycle canonical source: .codex/workflow.yaml — autobuild steps are Step 0–6 (distinct from the 7 lifecycle phases) -->

# mk:autobuild — Autonomous Multi-Hour Build Orchestration

Step-file workflow that runs the complete generator/evaluator harness pipeline as an autonomous build. Handles green-field product builds (planner stage → contract stage → evaluator loop → ship decision) with adaptive scaffolding density based on detected model tier.
<!-- Note: autobuild pipeline stages are numbered Step 0–6 (see Workflow section below). -->
<!-- "Stage" is used to name pipeline roles to avoid clashing with the 7 lifecycle phases. -->

## When to Use

Activate when:
- User runs `the autobuild skill "build a X"` (or any green-field product description)
- Existing kit detection routes a green-field "build me an app" intent here instead of `mk:cook`
- A multi-hour autonomous build is requested with no manual handholding

Skip when:
- The task is a single feature, bug fix, or refactor → use `the cook skill` instead
- The task is a doc update → use the existing doc skills
- The request is "explain X" or "review Y" → use the appropriate single-shot skill

## Hard Constraints

1. **Adaptive density** — picks scaffolding density via `mk:scale-routing` (or `density-select.sh`); honors `MEOWKIT_AUTOBUILD_MODE` env override
2. **Budget caps** — warns at $30 spent, requires explicit approval at $100, hard-blocks at user-set `--budget` value
3. **6-hour wall-clock timeout** — hard limit per Anthropic's observed runs <!-- research-citation -->; checkpoints every step for resumability
4. **Max 3 iteration rounds** between generator and evaluator before escalating to human (configurable via `--max-iter`)
5. **Run report mandatory** — every autobuild run produces `tasks/autobuild-runs/YYMMDD-{slug}/run.md` with full audit trail
6. **Coexists with `mk:cook`** — does not replace it; both route through Gate 1 + Gate 2
7. **TDD opt-in (parallel to cook):** autobuild respects `--tdd` like other flows. Default: no RED-phase gate. With `--tdd`: writes the `.codex/session-state/tdd-mode` sentinel and the developer waits on tester before each generator iteration. Active-verification HARD GATE (Rule 8 of `harness-rules.md`) is independent of TDD mode and always applies.

## Workflow

Execute via `workflow.md`. Step-file architecture — load one step at a time.

```
Step 0: Tier Detection      → call mk:scale-routing; pick density (MINIMAL|FULL|LEAN)
Step 1: Plan                → invoke mk:plan-creator --product-level
Step 2: Contract            → invoke mk:sprint-contract (skipped if LEAN + small)
Step 3: Generate            → spawn developer sub-task w/ 4-subphase pattern
Step 4: Evaluate            → invoke mk:evaluate
Step 5: Iterate or Ship     → PASS → shipper; FAIL → loop to step-3 (max --max-iter)
Step 6: Run Report          → write the audit trail
```

## Density Modes

| Mode | Tier | Planner | Contract | Iteration Loop | Context Reset |
|---|---|---|---|---|---|
| **MINIMAL** | TRIVIAL (Haiku) | Skip (use plan-creator --fast) | Skip | Skip | Skip |
| **FULL** | STANDARD (Sonnet) / COMPLEX (Opus 4.5) | Required | Required | 1–3 rounds | Optional |
| **LEAN** | COMPLEX (Opus 4.6+) | Required | Optional | 0–1 rounds | Skip (auto-compact) |

## Run Report Schema

Every run writes `tasks/autobuild-runs/YYMMDD-{slug}/run.md`:

```markdown
---
run_id: 260408-1450-build-todo
density: LEAN
model: opus-4-6
budget_cap: 50
budget_spent: 12.40
iterations: 1
status: PASS | WARN | FAIL | ESCALATED | TIMED_OUT
started: 2026-04-08T14:50:00Z
ended: 2026-04-08T15:18:00Z
---

# Autobuild Run — {task description}

## Density Decision
- Detected tier: {tier}
- Detected model: {model-id}
- Density: {MINIMAL|FULL|LEAN}
- Source: scale-routing | env-override | --tier flag

## Per-Step Artifacts
- step-00: {tier-detection result}
- step-01: tasks/plans/{plan-dir}/plan.md
- step-02: tasks/contracts/{contract}.md (or "skipped — LEAN small sprint")
- step-03: handoff at tasks/handoff/{slug}-sprint-1.md
- step-04: verdict at tasks/reviews/{slug}-evalverdict.md
- step-05: iteration count + final action
- step-06: this file

## Budget Trail
| Step | Spent | Cumulative |
|---|---|---|
| ... | ... | ... |

## Final Verdict
{PASS/FAIL/ESCALATED summary + next action}
```

## Gotchas

- **Don't run on a non-green-field task.** Use `mk:cook` for single features, bug fixes, refactors. The autobuild workflow is for "build me an app" scope.
- **Density override stays in scope.** `MEOWKIT_AUTOBUILD_MODE=LEAN` does NOT skip Gate 2. Review verdict is still mandatory before ship.
- **Iteration loops are bounded.** Max 3 by default. After round 3, escalate — don't keep iterating blindly.
- **Budget check is authoritative.** If `budget-tracker.sh` says block, the autobuild workflow halts even mid-iteration.
- **Run reports are append-only.** Don't edit prior steps' entries — the report is the audit trail.
- **Resumable.** If the autobuild workflow is killed mid-run, `the autobuild skill --resume {run-id}` picks up at the last completed step.

## References

| File | Purpose |
|---|---|
| `workflow.md` | Step sequence + variable table |
| `step-00-tier-detection.md` | Density selection via scale-routing |
| `step-01-plan.md` | Product-level planning |
| `step-02-contract.md` | Sprint contract negotiation |
| `step-03-generate.md` | Developer sub-task dispatch with 4-subphase pattern |
| `step-04-evaluate.md` | Evaluator dispatch |
| `step-05-iterate-or-ship.md` | PASS/FAIL routing + iteration loop |
| `step-06-run-report.md` | Audit trail writer |
| `references/adaptive-density-matrix.md` | Full decision table per tier × model |
| `references/agent-teams-vs-sub-task.md` | When to use teams vs file-based sub-task |
| `scripts/density-select.sh` | Standalone density selector for scriptable use |
| `scripts/budget-tracker.sh` | Cost-log reader; threshold warnings + hard block |
| `../plan-creator/` | Planner stage (Step 1) — product-level planner |
| `../sprint-contract/` | Contract stage (Step 2) — contract negotiation |
| `../rubric/` | Rubric stage (Step 2/4) — rubric library |
| `../evaluate/` | Evaluator stage (Step 4) — behavioral evaluator |
| `../scale-routing/` | Tier + density emission |

## Start

Read and follow `workflow.md`.