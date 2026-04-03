# Step 6: Validation Interview

Critical questions to validate plan decisions with the user. Hard mode only.

## Instructions

### 6a. Skip Check

**Skip if:** `planning_mode = fast` → read and follow `step-07-gate.md`.

### 6b. Generate Questions

Generate 3–5 critical questions from the plan content. Load question framework from
`references/validation-questions.md` for category guidance.

Question categories (use the most relevant for this plan):

1. **Architecture** — "Why {approach} instead of {alternative}?"
2. **Assumptions** — "The plan assumes {X}. Is this correct?"
3. **Scope** — "Phase {N} includes {Y}. Is this in scope or should it be deferred?"
4. **Risk** — "What happens if {risk} materializes?"
5. **Tradeoffs** — "This approach trades {A} for {B}. Is that acceptable?"

Note: if red-team findings were accepted in step-05, use them to inform questions —
focus on areas where assumptions or risks were flagged.

### 6c. Present via AskUserQuestion

Present each question individually:

```json
{
  "questions": [{
    "question": "{generated question based on plan content}",
    "header": "Plan Validation ({N} of {total})"
  }]
}
```

### 6d. Propagate Answers to Phase Files

After all answers received:

- Update **Key Insights** in the affected phase file with user's clarification
- Update **Risk Assessment** if risk tolerance changed
- Add note: `"Validated: {answer summary}"` in phase overview
- If an answer reveals scope change, update the plan's In Scope / Out of Scope sections

## Output

- Phase files updated with validated decisions
- Risk assessments updated where applicable

## Next

Read and follow `step-07-gate.md`
