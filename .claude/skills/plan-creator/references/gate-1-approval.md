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

**ACTION REQUIRED:** Use `AskUserQuestion` with these options:

```json
{
  "questions": [{
    "question": "Plan is ready. How would you like to proceed?",
    "header": "Gate 1",
    "options": [
      { "label": "Approve (Recommended)", "description": "Proceed to implementation. No code changes until now." },
      { "label": "Modify plan", "description": "Discuss changes with AI before approving. I'll help refine the plan." },
      { "label": "Reject", "description": "Discard this plan and start over with different requirements." }
    ],
    "multiSelect": false
  }]
}
```

**On "Approve":** Update Agent State, then print the Context Reminder (MANDATORY).
**On "Modify plan":** Ask what to change. Apply modifications. Re-validate. Present for approval again.
**On "Reject":** Ask for new requirements. Start over from Step 1.

Do NOT infer approval from silence. Do NOT proceed without explicit selection.

## Context Reminder (MANDATORY)

After plan approval, MUST output with **actual absolute path** and **mode-matched cook flag**:

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
