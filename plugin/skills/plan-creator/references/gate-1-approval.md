# Gate 1: Plan Approval Flow

## Step 7 — Present for Human Approval

Print a summary, then use `AskUserQuestion` for structured approval:

```
PLAN READY FOR GATE 1
Title: [title]
Type: [type] | Model: [workflow model] | Effort: [xs/s/m/l/xl]
Goal: [one sentence]
Phases: [list]
Files affected: [count or list]
Validation: PLAN_COMPLETE
```

**ACTION REQUIRED:** Use `AskUserQuestion`. Header: "Gate 1". Question: "Plan is ready. How would you like to proceed?" Single-select.

| Option | Recommend When | Why |
|--------|----------------|-----|
| Approve (Recommended) | Self-check has zero Uncertain items, all sections complete | Proceeds to task hydration. No code changes yet. |
| Modify plan | Minor changes needed; the agent applies them and re-presents | Iterates on the plan without restarting |
| Reject | Requirements have fundamentally changed | Discards the plan; user re-issues requirements |

**On "Approve":** Update Agent State, then proceed to `step-08-hydrate-tasks.md`. The Context Reminder is printed later by `step-09-post-plan-handoff.md` after the user selects a next-step option — do NOT print it from step-07.
**On "Modify plan":** Ask what to change. Apply modifications. Re-validate. Present for approval again.
**On "Reject":** Ask for new requirements. Start over from Step 1.

Do NOT infer approval from silence. Do NOT proceed without explicit selection.

## Context Reminder (MANDATORY)

> **NOTE — execution location.** The Context Reminder block below is printed by `step-09-post-plan-handoff.md` AFTER the user picks a next-step option (not by step-07 or step-08). Keeping it here as the canonical source so step-09 can substitute the absolute path and the mode-matched flag.

After the user selects the next-step option in step-09, MUST output with **actual absolute path** and **mode-matched cook flag**:

| Plan mode | Cook command |
|-----------|-------------|
| (default) / --hard | `/mk:cook {absolute-path}/plan.md` |
| --auto | `/mk:cook --auto {absolute-path}/plan.md` |
| --fast | `/mk:cook --auto {absolute-path}/plan.md` |
| --parallel | `/mk:cook --parallel {absolute-path}/plan.md` |
| --deep | `/mk:cook {absolute-path}/plan.md` |

Print this EXACT block (substitute actual path and flag):

```
┌─────────────────────────────────────────────────────────┐
│  ✅  Plan ready: [absolute path to plan.md]             │
│                                                         │
│  Review the plan above. When ready to implement, run:   │
│                                                         │
│      /mk:cook [flag] [absolute path to plan.md]       │
│                                                         │
│  💡 Run /clear first to reduce planning-context          │
│     carryover, then run the cook command above.          │
│                                                         │
│  ⏸  Waiting. Claude will not proceed automatically.    │
└─────────────────────────────────────────────────────────┘
```

**Why absolute path?** After `/clear`, the new session loses previous context.
**Why mode-matched flag?** Fast planning pairs with fast execution. Thorough planning needs interactive gates.

**STOP after printing this block. Do NOT auto-proceed to Phase 2.**
