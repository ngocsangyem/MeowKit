# Step 7: Present the Plan

Self-check, then show the plan to the user and settle it with them.

**`--advice` runs:** the REVIEW checkpoint fires BEFORE this step, never inside it
(`references/advice-checkpoints.md`). Athena does not settle the plan and its directive is
not part of the conversation with the user — `READY_FOR_EXISTING_GATE` means only that
presenting the plan is the correct next step. The exchange below is unchanged.

## Instructions

### 7a. Self-Check Before Presenting

State each category explicitly:

1. **Completed:** list what was done (semantic checks, structural validation, red team, interview)
2. **Skipped:** list what was intentionally skipped with justification (e.g., "Red team — fast mode")
3. **Uncertain:** list items the agent is unsure about (empty if none)

### 7b. Present the plan

Load `references/plan-presentation.md` for the exact user question format and Context Reminder block.

Present the plan by asking the user. Header: "Plan". Question text composes the self-check summary, plan path, phase count, and mode:

> Plan ready for review
>
> {self-check summary}
>
> Plan: {plan_dir}/plan.md
> Phases: {N} phase files
> Mode: {planning_mode}
> Autonomy Boundaries: {one-line summary of the Always / Ask-first latitude}   ← include ONLY when plan.md has an `## Autonomy Boundaries` block (long-horizon plans)
>
> All checks passed. Ready to proceed?

For long-horizon plans that carry an `## Autonomy Boundaries` block, note in the question that the user may adjust the Always / Ask-first latitude before you continue; record any adjustment in plan.md (and its Agent State) on Looks right / Modify. Omit the line entirely for fast / trivial / single-phase plans that have no block.

Single-select.

| Option | Recommend When | Why |
|--------|----------------|-----|
| Looks right | Self-check has zero Uncertain items and no Skipped item flags correctness risk | Plan is good — proceeds to task hydration |
| Modify | Minor changes needed first | Apply changes, re-validate, present again |
| Reject | Requirements have fundamentally changed | Restart from step-00 with new requirements |

### 7c. Handle Decision

**On "Looks right":**
- Update Agent State in plan.md: `Agreed with: human`, `Validation: agreed`
- Print Context Reminder block (from `references/plan-presentation.md`) with absolute path to plan.md
- Proceed to step-08

**On Modify:**
- Apply requested changes inline
- Re-run semantic checks (step-04 4a)
- Re-run structural validation (step-04 4b)
- Present the plan again

**On Reject:**
- Ask user for new or revised requirements
- Restart from `step-00-scope-challenge.md`

## Output

- Outcome: agreed | modified | rejected
- Context Reminder printed (once agreed) with cook command and absolute path

## Next

If agreed → read and follow `step-08-hydrate-tasks.md`
