# Step 5: Iterate or Ship

**Goal:** act on the verdict: ask the user about shipping, go round again with feedback, or escalate at the cap. Two parts of this step are fragile: the budget check, and the ship question. A verdict is evidence for the user's decision, not the decision, so no shipper starts before the user answers.

**Inputs:** `verdict`, `verdict_path`, `iteration`, `max_iter`, `budget_spent`.

## Decide

| verdict | rounds left? | Action |
|---|---|---|
| budget blocked (any verdict) | — | `final_status=TIMED_OUT`, step 6, no ship and no question |
| `PASS` | — | ship question (below) |
| `WARN` | yes | loop to step 3 with feedback |
| `WARN` | no | ship question with every WARN itemized; on "no", no ship |
| `FAIL` | yes | loop to step 3 with feedback |
| `FAIL` | no | escalate (below) |

Run `budget-tracker.sh check` first; exit 2 or 3 is the first row. `iterations` in `run.md` already holds this round.

## Ship question

Both ship-capable rows go through this one question; there is no second ship route.

With `--advice`, fire the REVIEW checkpoint first (`references/advice-checkpoints.md`). It may return the work for correction, in which case re-enter step 3 and re-evaluate, because the verdict put in front of the user must describe the code that exists.

Put the verdict path and its evidence in front of the user. For WARN, itemize each warning from the verdict's `## Warnings` section; a count is not an answer. Then ask (header "Ship"):

- **Ship it** (any WARNs shown are accepted as-is): dispatch the shipper. `mk:review` still runs inside it for the structural audit.
- **Iterate with feedback**: write the user's reason to `{run_dir}/feedback-iter-{n}.md`, set `next_step: step-03-generate.md`, and raise `max_iter` by 1 if at the cap.
- **Abort**: `final_status=ESCALATED`, step 6, no shipper.

On "Ship it", keep `final_status` as the verdict (`PASS` or `WARN`) and brief the shipper:

```
Goal: the approved build shipped
Inputs: verdict {verdict_path}; handoff tasks/handoff/{slug}-sprint-1.md; plan {plan_dir}/plan.md; the user chose to ship at step 5; acknowledged WARNs (if any) {list}
Files to modify: release artifacts only (changelog, version, tags); no source files
Constraints: run mk:review for the structural audit even though the evaluator passed; conventional commit and PR; record every acknowledged WARN in the release notes
Return: the PR or release reference and a status (DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT)
```

## Loop

Copy the verdict's `## Iteration Feedback` section to `{run_dir}/feedback-iter-{n}.md`, set `next_step: step-03-generate.md`, and tell the user the round number. With `--advice`, the RESCUE checkpoint applies only on a plateau (two consecutive verdicts failing the same criteria with no change in the evidence) or drift outside the signed contract; a first FAIL with concrete feedback is the loop working. A rescue directive does not buy another round.

## Escalate (FAIL at the cap)

Unless `MEOWKIT_PM_AUTO=off`, first run the one foreground project-manager delegation (`.claude/skills/cook/references/post-phase-delegation.md`, Rule 2 for the prompt and Rule 5 for why it is foreground) and include its headline in the question, so the user sees delivery state before deciding. Then ask (header "Escalate"):

- **One more iteration**: `max_iter` + 1, back to step 3.
- **Ship despite the FAIL**: the user accepts the risk. `final_status` stays `FAIL`; record the decision in the report, dispatch the shipper as above, and go to step 6.
- **Abort and triage**: `final_status=ESCALATED`, step 6, the evidence stays for manual triage.

This escalation runs on its own schedule; an earlier `--advice` rescue neither delays nor replaces it, and the decision is the human's.

## Record

Append a Step 05 entry to `run.md`: verdict in, action, the ship decision (including "no ship attempted"), advice checkpoints fired (`--advice` only), final status, iterations. A ship with no recorded user answer is the failure this step exists to prevent.

## Done when

`final_status` is set or `next_step` points back to step 3, and no shipper ran without a recorded yes.

## Next

`next_step` from `run.md`: `step-03-generate.md` when looping, otherwise `step-06-run-report.md`.
