# Step 7: Present the Plan

Show the plan and settle it with the user. Done when the user has answered Looks right, Modify or Reject; silence is not agreement.

`--advice` run: the REVIEW checkpoint fires before this step, never inside it (`references/advice-checkpoints.md`). Its approval to present is not the user's agreement.

## 7a. Self-check

Say what was completed (checks, red team, interview), what was skipped and why (for example "red team: fast mode"), and what you are unsure of. Include `Uncertain: none` when that is true.

## 7b. Ask

Show title, type, goal, phases, files affected, the structural-check result and the self-check, per `references/plan-presentation.md`. For a plan with an `## Autonomy Boundaries` block, add a line summarising it and say the user may adjust it now; record any adjustment in plan.md.

Ask the user (plain question if the runtime has no structured tool):

| Option | When |
|---|---|
| Looks right (recommended) | No uncertain items and no skipped step that risks correctness |
| Modify | Minor changes: apply them, rerun step 4, present again |
| Reject | Requirements changed fundamentally: ask for the new requirements, restart at step 0 |

On Looks right, go to step 8.

## Next

`step-08-hydrate-tasks.md`
