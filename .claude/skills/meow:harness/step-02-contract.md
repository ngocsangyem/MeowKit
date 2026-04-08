# Step 2: Sprint Contract (Conditional)

Negotiate a sprint contract via `meow:sprint-contract` (Phase 4). Skipped on `MINIMAL` (already short-circuited) and on `LEAN` for small builds.

## Instructions

### 2a. Skip-or-run decision

```
if density == "MINIMAL":  # already short-circuited at step-00
    skip
elif density == "LEAN":
    if estimated_ac_count < 5:
        skip with reason "LEAN small sprint — no contract"
    else:
        run
elif density == "FULL":
    run (always)
```

`estimated_ac_count` is derived by reading the product-level plan from step-01 and counting numbered features. If `feature_count < 3`, the resulting contract would have fewer than 5 ACs and the contract overhead exceeds the value — skip.

When skipped, write:

```markdown
## Step 02 — Contract
- Skipped (density: {LEAN}, estimated ACs: {N}, threshold: 5)
- Generator will work directly from product-level plan + rubric preset
```

Set `contract_path=null` and proceed to step-03.

### 2b. Run the contract negotiation

When density is `FULL` or `LEAN` with sufficient ACs:

```
Task(
  subagent_type="developer",
  description="Propose sprint 1 contract for $slug",
  prompt="
    Use meow:sprint-contract propose action with task slug: $slug

    Read the active product spec at $plan_dir/plan.md and the active rubric preset
    via meow:rubric/scripts/load-rubric.sh --preset frontend-app (or backend-api / cli-tool / fullstack-product as appropriate to the task).

    Draft 5–15 ACs in Given/When/Then form. Each must have a Verification line and a Rubric tie-in.

    Save to tasks/contracts/{date-time}-{slug}-sprint-1.md.
    Run validate-contract.sh to confirm schema clean.

    Work context: $(pwd)
  "
)
```

Then dispatch the evaluator for review:

```
Task(
  subagent_type="evaluator",
  description="Review proposed contract for $slug",
  prompt="
    Read tasks/contracts/*-${slug}-sprint-1.md (newest).
    Apply your Contract Reviewer Role (see evaluator.md).
    Append Round 1 (reviewer) entries to the Negotiation Log section.
    If clean, write 'Round 1 (reviewer): accepted'.
    Hard cap: 2 rounds. Round 3 escalates to AskUserQuestion.
  "
)
```

Iterate propose → review up to 2 rounds. After both sign:

```bash
contract_path=$(ls -t tasks/contracts/*-${slug}-sprint-1.md | head -1)
```

### 2c. Verify both signatures present

```bash
.claude/skills/meow:sprint-contract/scripts/check-contract-signed.sh
```

Must exit 0. If exit 1, the harness halts — escalate to user.

### 2d. Append to run report

```markdown
## Step 02 — Contract
- Path: {contract_path}
- Status: signed
- ACs: {N}
- Rounds: {1 or 2}
- Generator SHA: {sha}
- Evaluator SHA: {sha}
- Time: {duration}
- Cost: ~${cost}
```

Increment `budget_spent`. Run `budget-tracker.sh`.

## Output

- `contract_path` (absolute path or `null`) set
- Run report updated with Step 02 section

Print: `"Contract: {signed | skipped}. Proceeding to step-03 (generate)."`

## Next

Read and follow `step-03-generate.md`.
