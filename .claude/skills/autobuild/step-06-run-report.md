# Step 6: Run Report

**Goal:** finish the audit trail at `tasks/autobuild-runs/{run_id}/run.md`, tell the user where the run stands, and end. This step runs on every end state.

**Inputs:** the whole `run.md`, `final_status`, the artifact paths from earlier steps.

## Do

1. Unless `MEOWKIT_PM_AUTO=off` or density is `MINIMAL`, delegate one background `project-manager` status report per `.claude/skills/cook/references/post-phase-delegation.md` (Rule 2). Do not wait for it; cite its path in the report if it is ready.
2. Update the frontmatter: `iterations`, `budget_spent`, `status` (the `final_status`: `PASS`, `WARN`, `FAIL`, `ESCALATED` or `TIMED_OUT`), `ended`, and `duration`. Keep `run_id`, `density`, `model`, `budget_cap` and `started`.
3. Append these sections to the body, which Step 0 and the earlier steps began:
   - **Final Verdict**: one paragraph: what was built, the verdict, the next action. Say plainly if the user shipped over a FAIL or accepted WARNs.
   - **Per-Step Artifacts**: step, artifact path, status (plan, contract or "skipped" with the reason, handoff, verdict, final action).
   - **Budget Trail**: spend per step and the total. Steps with no host-reported cost show `0.00`.
   - **Iteration History**: round, verdict, action.
   - **Resumability**: the `next_step` a restart would open.
   The Density Decision section already exists from step 0; do not rewrite earlier entries, since the report is append-only.
4. Print a short summary to the user: status, density and model, iterations against the cap, budget, and the paths to the plan, contract, handoff, verdict and run log, plus what the user needs to do next, if anything.
5. Commit `run.md` so the audit trail is in version control (`autobuild: complete run {run_id} (status={final_status})`).

## Return

End with the four-status block; `workflow.md` ("End states and returns") says which status fits:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** {1-2 sentences: final verdict and the key driver}
**Concerns/Blockers:** {for ESCALATED or TIMED_OUT: the issue and the action needed from the user}
```

## Done when

`run.md` has a final `status`, the sections above, and is committed. This is the last step: end the session.
