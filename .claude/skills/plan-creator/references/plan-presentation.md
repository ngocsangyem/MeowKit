# Presenting the Plan

Used by step 7. Show the user this summary, then ask for a decision.

```
PLAN READY FOR REVIEW
Title: [title]
Type: [type] | Model: [workflow model] | Effort: [xs/s/m/l/xl]
Goal: [one sentence]
Phases: [list]
Files affected: [count or list]
Validation: PLAN_COMPLETE
```

Options and what each does: Looks right goes to step 8; Modify applies the change, reruns the checks and presents again; Reject asks for new requirements and restarts at step 0. Wait for an explicit selection.

Step 9 prints the cook line after the user picks the next step, so do not print it here. With the plan agreed, give the absolute path: a new session after `/clear` has lost this conversation. Fast planning pairs with `/mk:cook --auto`, a thorough plan with an interactive run.
