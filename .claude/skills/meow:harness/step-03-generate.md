# Step 3: Generate

Spawn the `developer` subagent to implement the build per the signed contract (or per the product spec directly when contract was skipped). Developer follows the 4-subphase generator pattern (`developer.md` → "Implementation Sub-Phases").

## Instructions

### 3a. Pre-flight checks

- `gate-enforcement.sh` will block source-code edits unless either (a) a signed contract exists OR (b) `MEOWKIT_HARNESS_MODE=LEAN`
- Confirm `plan_dir` is set (from step-01)
- Confirm `contract_path` is set OR null with reason logged (from step-02)
- Confirm `budget_spent` is below `budget_cap`

### 3b. Iteration index — read from run report (durable for --resume)

```bash
# Read current iteration count from run report frontmatter (set by step-05 on prior loop)
iteration=$(grep -E '^iterations:' "$run_dir/run.md" | head -1 | sed -E 's/^iterations:[[:space:]]*//')
iteration=${iteration:-0}
iteration=$((iteration + 1))   # increment for this pass

# Persist immediately (so --resume can find this exact iteration)
sed -i.bak "s/^iterations:.*/iterations: $iteration/" "$run_dir/run.md" && rm "$run_dir/run.md.bak"

echo "Iteration: $iteration / $max_iter"
```

The iteration counter lives in the run report frontmatter, NOT in session memory. This makes the harness resumable: a killed run can be restarted with `/meow:harness --resume {run_id}` and the orchestrator reads the last iteration from `$run_dir/run.md`.

### 3c. Dispatch the developer subagent

```
Task(
  subagent_type="developer",
  description="Generator iteration $iteration for $slug",
  prompt="
    Read your agent constitution at .claude/agents/developer.md.
    Follow the Implementation Sub-Phases section (Phase 5 generator pattern):
      1. Understand
      2. Design Direction
      3. Implement
      4. Verify (self-eval checklist — MANDATORY before handoff)
      5. Handoff

    Inputs:
    - Plan: $plan_dir/plan.md
    - Contract: ${contract_path:-'(no contract — LEAN mode small sprint, work directly from product spec)'}
    - Iteration: $iteration of $max_iter
    - Density: $density
    $(if [ $iteration -gt 1 ]; then echo '- Prior evaluator feedback: '"$verdict_path"' (read this and address every FAIL/WARN finding)'; fi)

    Constraints:
    - Stay within contract scope (Scope (Out) is forbidden)
    - Commit per criterion (atomic)
    - Self-eval checklist must be ALL CHECKED before handoff
    - Write handoff at tasks/handoff/${slug}-sprint-1.md
    - Mark sprint status 'ready_for_evaluator' in progress.md

    Acceptance criteria:
    - All in-scope contract ACs have corresponding code
    - Build compiles / typechecks (zero errors)
    - Self-eval checklist all checked
    - Git status clean (committed)

    Status: return DONE | DONE_WITH_CONCERNS | BLOCKED with handoff path

    Work context: $(pwd)
  "
)
```

### 3d. Verify handoff exists

```bash
handoff_path="tasks/handoff/${slug}-sprint-1.md"
if [ ! -f "$handoff_path" ]; then
  echo "BLOCKED: developer did not produce handoff file at $handoff_path" >&2
  final_status=FAIL
  next_step="step-06-run-report.md"
  # Persist next_step to run report frontmatter so the JIT-loaded next step file can find it
  sed -i.bak "s|^next_step:.*|next_step: $next_step|" "$run_dir/run.md" 2>/dev/null || \
    printf '\nnext_step: %s\n' "$next_step" >> "$run_dir/run.md"
  rm -f "$run_dir/run.md.bak"
fi
```

### 3e. Append to run report

```markdown
## Step 03 — Generate (iteration {N})
- Subagent: developer
- Pattern: 4-subphase (understand → design → implement → verify → handoff)
- Handoff: {handoff_path}
- Self-eval: {checklist outcome from handoff file}
- Files modified: {count from git diff}
- Time: {duration}
- Cost: ~${cost}
```

**Persist cost:**

The harness does not have native access to per-call token costs. The agent estimates `step_cost_usd` from elapsed wall-clock × tier rate (see `references/adaptive-density-matrix.md` for tier rates), or sets it to `0.00` if no estimate is feasible. The cost is a HINT for budget thresholds — not an authoritative billing record.

```bash
# Estimate: wall-clock seconds × per-second tier rate.
# Tier rates (USD/min, approximate Anthropic 2026 list pricing):
#   TRIVIAL (Haiku): 0.10
#   STANDARD (Sonnet): 0.50
#   COMPLEX (Opus): 1.20
# Default to 0.00 if elapsed_seconds is undefined.
elapsed_seconds="${step_elapsed_seconds:-0}"
case "$tier" in
  TRIVIAL) rate=0.10 ;;
  STANDARD) rate=0.50 ;;
  COMPLEX) rate=1.20 ;;
  *) rate=0.50 ;;
esac
step_cost_usd=$(awk -v s="$elapsed_seconds" -v r="$rate" 'BEGIN { printf "%.2f", (s/60.0)*r }')

MEOWKIT_RUN_ID="$run_id" .claude/skills/meow:harness/scripts/budget-tracker.sh add "$step_cost_usd" "step-03-iter-${iteration}"

# Check thresholds — exit code 0 ok, 1 warn, 2 hard block, 3 user cap
if ! MEOWKIT_RUN_ID="$run_id" .claude/skills/meow:harness/scripts/budget-tracker.sh check; then
  exit_code=$?
  if [ "$exit_code" -ge 2 ]; then
    final_status=TIMED_OUT
    echo "Budget breach at step-03 iter $iteration. Halting." >&2
    next_step="step-06-run-report.md"
    sed -i.bak "s|^next_step:.*|next_step: $next_step|" "$run_dir/run.md" 2>/dev/null || \
      printf '\nnext_step: %s\n' "$next_step" >> "$run_dir/run.md"
    rm -f "$run_dir/run.md.bak"
  fi
fi
```

## Output

- `handoff_path` set
- `iteration` incremented
- Run report updated with Step 03 section (one entry per iteration)

Print: `"Iteration $iteration: handoff at $handoff_path. Proceeding to step-04 (evaluate)."`

## Next

Read and follow `step-04-evaluate.md`.
