# Step 5: Iterate or Ship

Branch on the verdict from step-04. PASS → ship. WARN/FAIL with iterations remaining → loop. Cap reached → escalate to human.

## Instructions

### 5a. Decision matrix

| verdict | iteration < max_iter? | budget OK? | Action |
|---|---|---|---|
| `PASS` | — | — | Present Gate 2 (5c). On approval: route to shipper, set `final_status=PASS`, go to step-06 |
| `WARN` | yes | yes | Loop to step-03 with feedback |
| `WARN` | no | — | Present Gate 2 (5c) with every WARN itemized for acknowledgment. On approval: route to shipper, set `final_status=WARN`, go to step-06. On rejection: no ship |
| `FAIL` | yes | yes | Loop to step-03 with feedback |
| `FAIL` | no | — | `final_status=ESCALATED`, go to step-06 + escalate via stop and ask the user in chat (5e) |
| any | — | NO (budget breach) | `final_status=TIMED_OUT`, go to step-06 — no ship, no gate |

Both ship-capable rows (`PASS`, `WARN`-at-cap) route through the SAME human Gate 2 in 5c.
A human rejection at that gate means no ship, in either row.

### 5b. Compute the next action

This step does NOT branch with `goto`. Bash has no goto, and the autobuild workflow is JIT step-loaded — branching is done by setting a session variable `next_step` and the agent reading the appropriate file at the end.

Compute `next_action` based on verdict + iteration counter + budget. `next_step` is the
step to read once this one finishes — for the two ship-capable actions (`ship`,
`ship_with_warnings`) that only happens AFTER the human Gate 2 in 5c, and only if the
human approves. Setting `next_step` here is not permission to skip 5c.

```bash
# Persist iteration to run report frontmatter (for --resume)
sed -i.bak "s/^iterations:.*/iterations: $iteration/" "$run_dir/run.md" && rm "$run_dir/run.md.bak"

# Check budget — bail early if breached
if ! .agents/skills/autobuild/scripts/budget-tracker.sh check >/dev/null 2>&1; then
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
  # Ship-capable: goes through the SAME human Gate 2 as PASS (5c), with every
  # WARN itemized for acknowledgment. next_step is where 5c lands AFTER approval.
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

### 5c. Action: ship (verdict was PASS, or WARN at the iteration cap)

Handles BOTH ship-capable actions — `next_action == ship` and
`next_action == ship_with_warnings`. Every path that reaches a shipper passes through
this gate; there is no second ship route.

A verdict is **evidence**, not approval. Per `.agents/skills/rule-gate-rules.md` (The Gate
Authority Invariant), Gate 2 is human-only and has no exceptions — so a verdict routes to
Gate 2 *presentation*, it does not clear Gate 2. There is no env var or density mode that
skips this prompt.

**First, present Gate 2 via stop and ask the user in chat. Do NOT dispatch the shipper until the human approves.**

Surface the verdict and its evidence so the human decides on what the evaluator actually
found — not on the fact that it returned a grade.

For `ship_with_warnings`, Gate 2 condition 3 requires that **each WARN is explicitly seen
and accepted**. Itemize every WARN in the question; a count alone is not acknowledgment:

```bash
# Itemize the WARNs so each one is acknowledged, not summarized away.
awk '/^## Warnings/,/^## [^W]/' "$verdict_path" | sed '/^## /d;/^$/d' > "$run_dir/warns-iter-${iteration}.md"
```

```
stop and ask the user in chat(
  question: "Autobuild finished $slug with a {PASS | WARN-at-cap} verdict after $iteration iteration(s). Gate 2 requires your approval before shipping.
             Verdict: tasks/reviews/{slug}-evalverdict.md · Evidence: $run_dir/evidence/
             {if ship_with_warnings: 'Unresolved WARNs you are accepting:' + contents of $run_dir/warns-iter-${iteration}.md}
             Ship?",
  options: [
    { label: "Approve and ship", description: "Gate 2 approved{if ship_with_warnings: '; the WARNs above are accepted as-is'}. Dispatch the shipper (mk:review still runs for the structural audit)." },
    { label: "Reject — iterate with feedback", description: "Gate 2 not approved. Provide a reason; it becomes the feedback packet and re-enters step-03." },
    { label: "Abort", description: "Stop the autobuild workflow. No ship, no further iterations; the evidence stays for manual triage." }
  ]
)
```

Routing:

- **Approve and ship** → dispatch the shipper below, then step-06. Keep `final_status` as computed in 5b (`PASS` or `WARN`).
- **Reject — iterate with feedback** → write the user's reason to `$run_dir/feedback-iter-${iteration}.md`, set `next_step="step-03-generate.md"`, and re-enter the loop (raise `max_iter` by 1 if already at cap).
- **Abort** → set `final_status=ESCALATED`, proceed to step-06 with no shipper dispatch.

This is a distinct gate from the 5e escalation prompt. 5e fires only on the FAIL-at-cap
path and never runs on PASS or WARN — it is not a substitute for this step.

**After** the human approves, dispatch the shipper sub-task, then proceed to step-06.
On `ship_with_warnings`, pass the acknowledged WARNs through so the release notes record
what was accepted:

```
delegate a sub-task (
  subagent_type="shipper",
  description="Ship $slug after human Gate 2 approval",
  prompt="
    Read tasks/reviews/{slug}-evalverdict.md for the passing verdict.
    Read tasks/handoff/{slug}-sprint-1.md for the build summary.

    Work context: $(pwd)
    Files to modify: standard ship pipeline files (CHANGELOG, VERSION, git tags)
    Files to read: tasks/reviews/*-evalverdict.md, tasks/handoff/*.md, .codex/agents/shipper.md
    Acceptance criteria:
      - Gate 2 approved by the human at step-05 (recorded above) — the evaluator verdict is
        the evidence that was presented, not the approval itself
      - mk:review run for structural audit (do NOT bypass)
      - Conventional commit + PR created
      - If shipping with warnings: every acknowledged WARN from
        $run_dir/warns-iter-{N}.md is recorded in the release notes
    Constraints:
      - Do NOT bypass mk:review even though the evaluator passed
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

When `next_action == escalate`, first surface current delivery state to the user (foreground), then present a 3-option choice via stop and ask the user in chat.

**PM foreground invocation (per `.agents/skills/rule-post-phase-delegation.md` Rule 5 — the only foreground PM call):**

```
Delegate to the project-manager agent (foreground):
"Generate delivery status for plan at $plan_dir. Write report to
$plan_dir/status-reports/$(date +%y%m%d)-status.md.
Load template from tasks/templates/pm-status-template.md."
```

Wait for PM to return the report path, then include the headline in the escalation question so the user sees current state before deciding. Skip the PM call entirely when `MEOWKIT_PM_AUTO=off`.

Then present via stop and ask the user in chat BEFORE proceeding to step-06:

```
stop and ask the user in chat(
  question: "Autobuild reached max iterations ($max_iter) with FAIL verdict on $slug. How do you want to proceed?",
  options: [
    { label: "Continue with one more iteration", description: "Increase max_iter by 1 and re-enter step-03" },
    { label: "Ship with FAIL warning", description: "Force-ship despite verdict — accept the risk" },
    { label: "Abort and triage", description: "Stop the autobuild workflow; user takes over manually with the evidence" }
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
- Action: {ship | ship_with_warnings | loop | escalate | timeout}
- Gate 2: {approved by human | rejected by human | N/A — no ship attempted}
- Final status: {PASS | WARN | FAIL | ESCALATED | TIMED_OUT}
- Iterations completed: {N}
- WARNs acknowledged (if ship_with_warnings): {path to warns-iter-{N}.md}
- Feedback packet (if loop): {path to feedback-iter-{N}.md}
```

Record the Gate 2 line for every run. A ship recorded with no human approval is the
regression this step exists to prevent — the run report is where it stays visible.

## Output

- `final_status` set
- Either looped back to step-03 OR proceeding to step-06
- Run report updated with Step 05 section
- No shipper dispatched without a recorded human Gate 2 approval

Print: `"Action: {ship|ship_with_warnings|loop|escalate|timeout}. Gate 2: {approved|rejected|N/A}. Final status: $final_status."`

## Next

Read and follow whichever step is named in `$next_step`:

- `step-03-generate.md` if looping (next iteration with feedback, or after a Gate 2 rejection)
- `step-06-run-report.md` for ship / escalate / timeout

The loop control is the `$next_step` variable, not a goto statement. Bash has no goto.
