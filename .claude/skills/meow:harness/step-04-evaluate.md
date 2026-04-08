# Step 4: Evaluate

Spawn the `evaluator` subagent via `meow:evaluate` to actively verify the build against the rubric library. Returns a graded verdict (`PASS | WARN | FAIL`) with concrete runtime evidence.

## Instructions

### 4a. Determine the target

The evaluator needs a runnable target. Two cases:

1. **Generator started a dev server in step-03** — `handoff_path` should record the URL or how to start it. Read it from the handoff file.
2. **Generator built a path-style target (no live URL)** — pass the project path to `meow:evaluate`, which will boot it (step-02 of meow:evaluate workflow).

```bash
# Read target hint from handoff
target=$(grep -E '^target:' "$handoff_path" | sed 's/^target: //')
[ -z "$target" ] && target=$(pwd)  # default to project root
```

### 4b. Determine the rubric preset

Use the same preset that the contract was bound to (from step-02). If the contract was skipped (LEAN small sprint), default by detected project type:

| Project type signal | Preset |
|---|---|
| `package.json` + has `react`/`vue`/`svelte`/`next` deps | `frontend-app` |
| `package.json` + has `express`/`fastify`/`hono` AND no UI framework | `backend-api` |
| Single binary / CLI tool | `cli-tool` |
| Has frontend AND backend | `fullstack-product` |

### 4c. Dispatch the evaluator subagent

```
Task(
  subagent_type="evaluator",
  description="Evaluate iteration $iteration of $slug",
  prompt="
    Read your agent constitution at .claude/agents/evaluator.md.
    Follow the Active Verifier Loop section (Phase 3 — pending Phase 5 integration).

    Use meow:evaluate skill — read its workflow.md and follow steps 1–5.

    Inputs:
    - Target: $target
    - Rubric preset: $preset
    - Handoff: $handoff_path
    - Contract: ${contract_path:-'(no contract — grade against product spec directly)'}
    - Iteration: $iteration of $max_iter

    HARD GATE: every verdict must include non-empty evidence/ directory.
    validate-verdict.sh enforces this — empty evidence → automatic FAIL conversion.

    Skeptic persona: leniency is a failure. Mark WARN when unsure, never PASS.

    Output:
    - Verdict file at tasks/reviews/{slug}-evalverdict.md
    - Evidence directory at tasks/reviews/{slug}-evalverdict-evidence/
    - Return overall verdict: PASS | WARN | FAIL

    Status: return DONE | DONE_WITH_CONCERNS | BLOCKED with verdict path

    Work context: $(pwd)
  "
)
```

### 4d. Parse verdict result

```bash
# Anchored glob: date-prefix + EXACT slug + suffix.
# Loose glob `*-${slug}-evalverdict.md` would substring-match other slugs
# (e.g., slug "task" would match "subtask-evalverdict.md").
# Anchoring on the leading date prefix and trailing literal closes that gap.
shopt -s nullglob 2>/dev/null || true
verdict_path=""
for f in tasks/reviews/[0-9][0-9][0-9][0-9][0-9][0-9]-${slug}-evalverdict.md \
         tasks/reviews/[0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]-${slug}-evalverdict.md; do
  [ -f "$f" ] || continue
  # Use the newest match
  if [ -z "$verdict_path" ] || [ "$f" -nt "$verdict_path" ]; then
    verdict_path="$f"
  fi
done

if [ -z "$verdict_path" ]; then
  echo "BLOCKED: evaluator did not produce verdict file matching slug '$slug'" >&2
  final_status=FAIL
  next_step="step-06-run-report.md"
  # Persist for JIT step loader (no `return 1` — that only works in functions/sourced scripts)
  sed -i.bak "s|^next_step:.*|next_step: $next_step|" "$run_dir/run.md" 2>/dev/null || \
    printf '\nnext_step: %s\n' "$next_step" >> "$run_dir/run.md"
  rm -f "$run_dir/run.md.bak"
fi

verdict=$(grep -E '^overall:' "$verdict_path" | head -1 | sed 's/^overall: //')
```

### 4e. Verify the validator stamp

`validate-verdict.sh` should have stamped the verdict file. If not, the verdict is untrusted:

```bash
if ! grep -q "^## Validator Stamp" "$verdict_path"; then
  echo "BLOCKED: verdict $verdict_path lacks validator stamp" >&2
  verdict=FAIL  # treat unstamped as FAIL
fi
```

### 4f. Append to run report

```markdown
## Step 04 — Evaluate (iteration {N})
- Subagent: evaluator
- Verdict file: {verdict_path}
- Verdict: {PASS | WARN | FAIL}
- Weighted score: {from frontmatter}
- Hard fail: {bool}
- Evidence files: {count}
- Time: {duration}
- Cost: ~${cost}
```

**Persist cost:** Same wall-clock × tier-rate estimation as step-03 (see `step-03-generate.md` for the rate table). Pass `0.00` if no estimate is feasible.

```bash
elapsed_seconds="${step_elapsed_seconds:-0}"
case "$tier" in
  TRIVIAL) rate=0.10 ;;
  STANDARD) rate=0.50 ;;
  COMPLEX) rate=1.20 ;;
  *) rate=0.50 ;;
esac
step_cost_usd=$(awk -v s="$elapsed_seconds" -v r="$rate" 'BEGIN { printf "%.2f", (s/60.0)*r }')

MEOWKIT_RUN_ID="$run_id" .claude/skills/meow:harness/scripts/budget-tracker.sh add "$step_cost_usd" "step-04-iter-${iteration}"
MEOWKIT_RUN_ID="$run_id" .claude/skills/meow:harness/scripts/budget-tracker.sh check
```

## Output

- `verdict_path` set
- `verdict` set to `PASS | WARN | FAIL`
- Run report updated with Step 04 section (one entry per iteration)

Print: `"Iteration $iteration verdict: $verdict. Proceeding to step-05 (iterate or ship)."`

## Next

Read and follow `step-05-iterate-or-ship.md`.
