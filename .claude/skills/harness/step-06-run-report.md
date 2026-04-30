# Step 6: Run Report

Finalize the audit trail at `tasks/harness-runs/{run_id}/run.md`. Print a user-facing summary. End the harness session.

## Instructions

### 6a0. PM delegation (background) — per `.claude/rules/post-phase-delegation.md` Rule 1

Before finalizing the run report, delegate to `project-manager` (background):

```
Delegate to the project-manager agent:
"Generate delivery status for plan at $plan_dir. Write report to
$plan_dir/status-reports/$(date +%y%m%d)-status.md.
Load template from tasks/templates/pm-status-template.md.
Run in the background — do not block step-06 finalization."
```

Do not block on PM — continue to 6a. The run report's Final Verdict section (6b) may cite the PM report path if available, otherwise proceeds without it. Skipped entirely when `MEOWKIT_PM_AUTO=off` or `MEOWKIT_HARNESS_MODE=MINIMAL`.

### 6a. Update run report frontmatter

Open `$run_dir/run.md` and update the frontmatter with the final state:

```yaml
---
run_id: {run_id}
density: {density}
model: {model_id}
budget_cap: {budget_cap}
budget_spent: {budget_spent}      # final number
iterations: {iteration}            # final iteration count
status: {final_status}             # PASS | WARN | FAIL | ESCALATED | TIMED_OUT
started: {started_iso}
ended: {now_iso}
duration: {duration_human}
---
```

### 6b. Append the Final Verdict section

```markdown
## Final Verdict

{1-paragraph summary: what was built, the verdict, the next action}

## Budget Trail

| Step | Spent (USD) | Cumulative |
|---|---|---|
| step-00 | ~0.01 | 0.01 |
| step-01 | ~$X | $Y |
| step-02 | ~$X | $Y |
| step-03 (iter 1) | ~$X | $Y |
| step-04 (iter 1) | ~$X | $Y |
| ... | ... | ... |
| **Total** | — | **${budget_spent}** |

## Per-Step Artifacts

| Step | Artifact | Status |
|---|---|---|
| step-00 | Density: {density} | OK |
| step-01 | tasks/plans/{plan_dir}/plan.md | {OK | gated/skipped} |
| step-02 | tasks/contracts/{contract_path}.md | {OK | skipped} |
| step-03 | tasks/handoff/{slug}-sprint-1.md | {OK | failed} |
| step-04 | tasks/reviews/{slug}-evalverdict.md | {OK | failed} |
| step-05 | {ship | loop | escalate | timeout} | {final action} |

## Density Decision Audit

- Detected tier: {tier}
- Detected model: {model_id}
- Density chosen: {density}
- Source: {scale-routing | env-override | --tier flag}
- Override env var: {MEOWKIT_HARNESS_MODE | unset}

## Iteration History

| Iter | Verdict | Action | Time | Cost |
|---|---|---|---|---|
| 1 | PASS/WARN/FAIL | continue/loop/ship | ... | ... |
| 2 | ... | ... | ... | ... |

## Resumability

If this run was killed mid-flight:
- Resume via `/mk:harness --resume {run_id}`
- The orchestrator reads this file to find the last completed step
- Steps are append-only; resume picks up at the next un-started step
```

### 6c. Print user summary

```bash
cat <<EOF
═══════════════════════════════════════════════════════════════════
Harness Run Complete — $run_id
═══════════════════════════════════════════════════════════════════
Status:     $final_status
Density:    $density ($model_id)
Iterations: $iteration / $max_iter
Budget:     \$$budget_spent / \$$budget_cap
Duration:   $duration_human

Artifacts:
  Plan:      $plan_dir/plan.md
  Contract:  ${contract_path:-skipped}
  Handoff:   $handoff_path
  Verdict:   $verdict_path
  Run log:   $run_dir/run.md

Next action: $next_action_summary
═══════════════════════════════════════════════════════════════════
EOF
```

### 6d. Final git commit

Commit the run report so the audit trail is in version control:

```bash
git add "$run_dir/run.md"
git commit -m "harness: complete run $run_id (status=$final_status, density=$density, iters=$iteration)"
```

### 6e. Status protocol return

Return to the caller (user or wrapping harness invocation):

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED
**Summary:** {1-2 sentences: final verdict + key driver}
**Concerns/Blockers:** {if final_status == ESCALATED or TIMED_OUT, list the issue and the user action needed}
```

## Output

- `$run_dir/run.md` finalized with frontmatter, all sections, and committed to git
- User summary printed
- Status block returned

## Next

This is the final step. Return control to the caller.

The orchestrator is responsible for any post-harness actions (e.g., notifying a user, posting to a channel). The harness itself is complete after step-06.

End the session.
