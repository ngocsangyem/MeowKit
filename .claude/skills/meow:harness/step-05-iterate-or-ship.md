# Step 5: Iterate or Ship

Branch on the verdict from step-04. PASS → ship. WARN/FAIL with iterations remaining → loop. Cap reached → escalate to human.

## Instructions

### 5a. Decision matrix

| verdict | iteration < max_iter? | budget OK? | Action |
|---|---|---|---|
| `PASS` | — | — | Route to shipper, set `final_status=PASS`, go to step-06 |
| `WARN` | yes | yes | Loop to step-03 with feedback |
| `WARN` | no | — | `final_status=WARN`, go to step-06 (ship with documented warnings) |
| `FAIL` | yes | yes | Loop to step-03 with feedback |
| `FAIL` | no | — | `final_status=ESCALATED`, go to step-06 + escalate via AskUserQuestion |
| any | — | NO (budget breach) | `final_status=TIMED_OUT`, go to step-06 |

### 5b. Compute the next action

This step does NOT branch with `goto`. Bash has no goto, and the harness is JIT step-loaded — branching is done by setting a session variable `next_step` and the agent reading the appropriate file at the end.

Compute `next_action` based on verdict + iteration counter + budget:

```bash
# Persist iteration to run report frontmatter (for --resume)
sed -i.bak "s/^iterations:.*/iterations: $iteration/" "$run_dir/run.md" && rm "$run_dir/run.md.bak"

# Check budget — bail early if breached
if ! .claude/skills/meow:harness/scripts/budget-tracker.sh check >/dev/null 2>&1; then
  final_status=TIMED_OUT
  next_step="step-06-run-report.md"
elif [ "$verdict" = "PASS" ]; then
  final_status=PASS
  next_step="step-06-run-report.md"
  next_action="ship"
elif { [ "$verdict" = "WARN" ] || [ "$verdict" = "FAIL" ]; } && [ "$iteration" -lt "$max_iter" ]; then
  next_step="step-03-generate.md"  # loop back
  next_action="loop"
elif [ "$verdict" = "WARN" ] && [ "$iteration" -ge "$max_iter" ]; then
  final_status=WARN
  next_step="step-06-run-report.md"
  next_action="ship_with_warnings"
else
  # FAIL at iteration cap → escalate
  final_status=ESCALATED
  next_step="step-06-run-report.md"
  next_action="escalate"
fi
```

### 5c. Action: ship (verdict was PASS)

When `next_action == ship`, dispatch the shipper subagent BEFORE proceeding to step-06:

```
Task(
  subagent_type="shipper",
  description="Ship $slug after harness PASS verdict",
  prompt="
    Read tasks/reviews/{slug}-evalverdict.md for the passing verdict.
    Read tasks/handoff/{slug}-sprint-1.md for the build summary.

    Work context: $(pwd)
    Files to modify: standard ship pipeline files (CHANGELOG, VERSION, git tags)
    Files to read: tasks/reviews/*-evalverdict.md, tasks/handoff/*.md, .claude/agents/shipper.md
    Acceptance criteria:
      - Gate 2 review verdict satisfied (the evaluator stamp counts)
      - meow:review run for structural audit (do NOT bypass)
      - Conventional commit + PR created
    Constraints:
      - Do NOT bypass meow:review even though the evaluator passed
      - Do NOT modify source files; only release artifacts
  "
)
```

### 5d. Action: loop (verdict was WARN/FAIL with iterations remaining)

When `next_action == loop`, build a feedback packet for the next iteration:

```bash
# Build feedback packet from the verdict's Iteration Feedback section
awk '/^## Iteration Feedback/,/^## [^I]/' "$verdict_path" | head -50 > "$run_dir/feedback-iter-${iteration}.md"

echo "$verdict verdict on iteration $iteration. Re-entering step-03 with feedback packet at $run_dir/feedback-iter-${iteration}.md"
```

The next session reads `step-03-generate.md` again. step-03 reads the iteration counter from the run report frontmatter (set at 5b) and the feedback packet to inform the next generator pass.

### 5e. Action: escalate (verdict was FAIL at iteration cap)

When `next_action == escalate`, present a 3-option choice via AskUserQuestion BEFORE proceeding to step-06:

```
AskUserQuestion(
  question: "Harness reached max iterations ($max_iter) with FAIL verdict on $slug. How do you want to proceed?",
  options: [
    { label: "Continue with one more iteration", description: "Increase max_iter by 1 and re-enter step-03" },
    { label: "Ship with FAIL warning", description: "Force-ship despite verdict — accept the risk" },
    { label: "Abort and triage", description: "Stop the harness; user takes over manually with the evidence" }
  ]
)
```

If user picks "Continue with one more iteration": increment `max_iter` by 1, set `next_step="step-03-generate.md"`, continue.
If user picks "Ship with FAIL warning": set `final_status=PASS_WITH_OVERRIDE`, dispatch shipper, then step-06.
If user picks "Abort and triage": set `final_status=ESCALATED`, proceed to step-06 (no shipper dispatch).

### 5f. Append to run report

```markdown
## Step 05 — Iterate or Ship (iteration {N})
- Verdict in: {PASS | WARN | FAIL}
- Action: {ship | loop | escalate | timeout}
- Final status: {PASS | WARN | FAIL | ESCALATED | TIMED_OUT}
- Iterations completed: {N}
- Feedback packet (if loop): {path to feedback-iter-{N}.md}
```

## Output

- `final_status` set
- Either looped back to step-03 OR proceeding to step-06
- Run report updated with Step 05 section

Print: `"Action: {ship|loop|escalate|timeout}. Final status: $final_status."`

## Next

Read and follow whichever step is named in `$next_step`:

- `step-03-generate.md` if looping (next iteration with feedback)
- `step-06-run-report.md` for ship / escalate / timeout / WARN-at-cap

The loop control is the `$next_step` variable, not a goto statement. Bash has no goto.
