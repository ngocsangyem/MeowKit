# Step 7: Gate 1

Self-check and Gate 1 presentation for human approval.

## Instructions

### 7a. Self-Check Before Presenting

State each category explicitly:

1. **Completed:** list what was done (semantic checks, structural validation, red team, interview)
2. **Skipped:** list what was intentionally skipped with justification (e.g., "Red team — fast mode")
3. **Uncertain:** list items the agent is unsure about (empty if none)

### 7b. Present Gate 1

Load `references/gate-1-approval.md` for the exact AskUserQuestion format and Context Reminder block.

Present the plan for approval:

```json
{
  "questions": [{
    "question": "Gate 1 — Plan Ready for Approval\n\n{self-check summary}\n\nPlan: {plan_dir}/plan.md\nPhases: {N} phase files\nMode: {planning_mode}\n\nAll checks passed. Ready to proceed?",
    "header": "Gate 1: Plan Approval",
    "options": [
      { "label": "Approve", "description": "Plan is good — proceed to task hydration" },
      { "label": "Modify", "description": "Apply changes, re-validate, present again" },
      { "label": "Reject", "description": "Restart from step-00 with new requirements" }
    ],
    "multiSelect": false
  }]
}
```

### 7c. Handle Decision

**On Approve:**
- Update Agent State in plan.md: `Approved by: human`, `Validation: approved`
- **Memory capture** (lightweight, no subagent): Append to `.claude/memory/architecture-decisions.md`:
  ```markdown
  ## Plan: {plan-dir-name} ({YYYY-MM-DD})
  - **Mode:** {planning_mode} | **Scope:** {scope_mode} | **Model:** {workflow_model} | **TDD:** {tdd_mode}
  - **Key decisions:** {1-2 bullet summary of architectural choices or scope decisions}
  - **Research highlights:** {1-2 most important research findings, or "no research (fast mode)"}
  - **Red-team accepted:** {N} findings (or "skipped (fast mode)")
  - **Status:** live-captured
  ```
  Skip silently if `.claude/memory/architecture-decisions.md` doesn't exist or write fails.
- Print Context Reminder block (from `references/gate-1-approval.md`) with absolute path to plan.md
- Proceed to step-08

**On Modify:**
- Apply requested changes inline
- Re-run semantic checks (step-04 4a)
- Re-run structural validation (step-04 4b)
- Present Gate 1 again

**On Reject:**
- Ask user for new or revised requirements
- Restart from `step-00-scope-challenge.md`

## Output

- Gate 1 verdict: approved | modified | rejected
- Context Reminder printed (on approval) with cook command and absolute path

## Next

If approved → read and follow `step-08-hydrate-tasks.md`
