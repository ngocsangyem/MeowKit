# `--advice` stages

Opt-in supervision for one standard or deep run. Without the flag nothing here loads and zero calls happen. The call protocol and the dispositions are owned by the contracts `SKILL.md` names under `--advice`; read them at the first checkpoint.

| Stage | Fires at | Condition | Max |
|---|---|---|---:|
| GUIDE | Before the first edit (process step 5) | Root cause confirmed, or a diagnostic report was handed off | 1 |
| RESCUE | Process step 5 | Two distinct fix approaches failed, or the evidence contradicts itself, or the step is irreversible (security boundary, public contract, possible data loss) | 2 |
| REVIEW | After verify, before the normal review (steps 6 to 7) | Always, with the flag on | 1 |
| RECHECK | After corrections from `RETURN_TO_EXECUTOR` | Only after a return | 1 |

Hard cap 5 calls per run, charged as `--skill mk:fix`. The three-failed-attempts stop fires on its own schedule whether or not RESCUE ran.

What each asks: GUIDE, which fix path carries the least risk and what proof would show it worked; RESCUE, what the evidence supports and what would disconfirm the current hypothesis; REVIEW, whether the evidence covers the bug and its regression; RECHECK, whether the corrections were addressed and proven.

Supervision is evidence, not authority: it cannot pass a review or check, never counts as verification, and cannot agree a plan.

Dispositions in this skill:

- `CONTINUE_WITH_DIRECTIVE`: proceed; the directive is input, not instruction.
- `READY_FOR_EXISTING_GATE`: run the normal review; it is not passed.
- `RETURN_TO_EXECUTOR`: apply the corrections, then supersede the stale evidence with `mewkit advice commit … --disposition RETURN_TO_EXECUTOR --evidence <workflow-evidence.json> --correction-kind source|scope`, and re-run the fix step before the review. `scope` also sends the plan back to the user.
- `ESCALATE_TO_HUMAN`: stop at the existing human touchpoint.
- `BLOCKED_MISSING_EVIDENCE`: supply the named evidence or continue unsupervised.

If the runtime cannot delegate to `athena`, print exactly `advice checkpoint unavailable in this runtime: <reason>` and continue unsupervised. A packet written inline and presented as the agent's is not an independent check.
