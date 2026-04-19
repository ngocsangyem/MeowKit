# Step 1: Plan (Product-Level)

Invoke `meow:plan-creator` in product-level mode (Phase 1 of the harness plan). Produces an ambitious user-story spec at `tasks/plans/{date}-{slug}/plan.md` with no implementation details.

## Instructions

### 1a. Mode selection by density

| density | plan-creator flag |
|---|---|
| `LEAN` | `--product-level` |
| `FULL` | `--product-level` |
| `MINIMAL` | (already short-circuited at step-00; never reaches here) |

### 1b. Invoke the planner

Use the Task tool to dispatch the `planner` agent (canonical subagent_type per `rules/` §2). The planner runs `meow:plan-creator` internally.

```
Task(
  subagent_type="planner",
  description="Product-level spec for $task_description",
  prompt="
    Use meow:plan-creator with --product-level mode.

    Task: $task_description

    Constraints:
    - Produce 8–20 features (ambitious default)
    - Each feature has ≥2 user stories
    - NO file paths, NO class names, NO SQL DDL
    - Run check-product-spec.sh at the end; must exit 0
    - Save to tasks/plans/{date}-{slug}/plan.md
    - Return the absolute plan path

    Work context: $(pwd)
    Reports: tasks/plans/reports/
  "
)
```

### 1c. Capture outputs

The planner returns the absolute plan path. Capture:

```bash
plan_dir=$(echo "$planner_output" | grep -E '^Plan:' | sed 's/Plan: //' | xargs dirname)
slug=$(basename "$plan_dir" | sed -E 's/^[0-9]{6}(-[0-9]{4})?-//')
```

Persist `plan_dir` and `slug` for downstream steps.

### 1d. Verify Gate 1

The planner enforces Gate 1 internally (user must approve the plan before the plan-creator skill returns). If the planner reports the plan was rejected or modified, halt the harness and surface the user feedback — do NOT proceed to step-02.

### 1e. Append to run report

```markdown
## Step 01 — Plan
- Mode: --product-level
- Plan: {absolute path}
- Slug: {slug}
- Gate 1: approved
- Features: {N from check-product-spec.sh output}
- User stories: {M}
- Time: {duration}
- Cost: ~${planner_cost}
```

Increment `budget_spent`. Run `budget-tracker.sh` to check threshold.

## Output

- `plan_dir` (absolute path) set
- `slug` set
- Run report updated with Step 01 section

Print: `"Plan ready at {plan_dir}. {N} features. Proceeding to step-02 (contract)."`

Print: `"Optional: /meow:plan-ceo-review {plan_dir}/plan.md — strategic review before implementation."`

## Next

Read and follow `step-02-contract.md`.
