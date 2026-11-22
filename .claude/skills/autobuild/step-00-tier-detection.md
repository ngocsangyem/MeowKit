# Step 0: Tier Detection

**Goal:** choose the scaffolding density and open the run.

**Inputs:** `task_description`, optional `--tier`, `--max-iter`, `--budget`, the `MEOWKIT_AUTOBUILD_MODE` env var.

## Do

1. Resolve density. The override order and the model table are in `references/adaptive-density-matrix.md`; `scripts/density-select.sh` implements them (pass `--tier` through; `auto` means detect). An unknown model gets `FULL`. Record which source decided.
2. Capture the model id for the run report.

For the run report. Use the same env var fallback chain as `density-select.sh` (POSIX parameter expansion, not echo trick):

```bash
model_id="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-${ANTHROPIC_MODEL:-unknown}}}"
```

3. Create `tasks/autobuild-runs/{run_id}/run.md` (run id and state: `workflow.md`) with `status: in_progress`, `iterations: 0`, `next_step: step-01-plan.md`, the density, the model and the budget cap (default 50). Step 6 owns the body sections; write only the title and a Density Decision section here (detected model, density, source).
4. Tell the user: `Density: {density} ({model}). Run: {run_id}`.

## Done when

`run.md` exists with the density and its source, and `density` is one of the three values.

## Next

`MINIMAL`: run `/mk:cook "$task_description"`, note it in the report and go to `step-06-run-report.md`. Otherwise `step-01-plan.md`.
