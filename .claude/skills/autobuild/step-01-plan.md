# Step 1: Plan

**Goal:** a product-level spec the build can follow: user stories, features and design language, with no file paths, class names or schemas, because over-specified plans narrow what a capable generator can find on its own.

**Inputs:** `task_description`, `density`.

## Do

Delegate to the `planner` agent, which runs `mk:plan-creator` (`--product-level`; `--fast` is never needed here because `MINIMAL` already left). Ask for an ambitious spec that covers what the task needs, not a fixed feature count.

Brief:

```
Goal: a product spec the build steps can follow
Task: {task_description}
Mode: mk:plan-creator --product-level
Constraints: no file paths, class names or SQL; save to tasks/plans/{YYMMDD}-{slug}/plan.md; `.claude/skills/plan-creator/scripts/check-product-spec.sh` must exit 0
Work context: {project root}
Return: the absolute plan path and a status (DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT)
```

Set `plan_dir` and `slug` from the path it returns. The planner agrees the plan with the user before returning; if the user rejected or reworked it, stop and report their feedback. Do not carry on with a plan the user did not want.

Run `budget-tracker.sh check`, and append a short Step 01 entry to `run.md`: plan path, whether the user agreed, feature count.

## Done when

The plan exists at `plan_dir/plan.md`, `check-product-spec.sh` exited 0, and the user agreed it.

Optional: suggest `/mk:plan-ceo-review {plan_dir}/plan.md` for a strategic read before building.

## Next

`step-02-contract.md`.
