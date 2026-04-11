# Step 6: Validation Interview

Critical questions to validate plan decisions with the user. Runs in hard/deep/parallel/two modes (skipped in fast).

## Instructions

### 6a. Skip Check

**Skip if:** `planning_mode = fast` → read and follow `step-07-gate.md`.

### 6b. Generate Questions

Generate 3–5 critical questions from the plan content. Load the full question framework from
`references/validation-questions.md` — it defines:

- **Detection keywords** per category (scan plan content for keyword matches → prioritize matching categories)
- **Question format rules** (2-4 concrete options, mark recommended, "Other" is automatic)
- **Section mapping** (which phase section each category's answers propagate to)
- **Recording rules** (Validation Log format)

**Categories** (prioritize by detection keyword matches):

1. **Architecture** — keywords: database, schema, API, endpoint, microservice, cache, queue, service
2. **Assumptions** — keywords: assume, expect, should be, will be, always, never, guaranteed
3. **Scope** — keywords: MVP, defer, future, nice-to-have, optional, out of scope
4. **Risk** — keywords: risk, fail, break, downtime, migration, rollback, breaking change
5. **Tradeoffs** — keywords: tradeoff, versus, vs, alternative, simpler, technical debt

Note: if red-team findings were accepted in step-05, use them to inform questions —
focus on areas where assumptions or risks were flagged.

### 6c. Present via AskUserQuestion

Present each question with 2-4 concrete options (per format rules). Mark the recommended option.

```json
{
  "questions": [{
    "question": "{generated question based on plan content}",
    "header": "Plan Validation ({N} of {total})",
    "options": [
      { "label": "{Option A} (Recommended)", "description": "{brief rationale}" },
      { "label": "{Option B}", "description": "{brief rationale}" }
    ]
  }]
}
```

Group related questions (max 4 per AskUserQuestion call).

### 6d. Propagate Answers to Phase Files

After all answers received, use the **section mapping** from `references/validation-questions.md`:

- **Architecture** answers → phase `## Architecture` section
- **Assumptions** answers → phase `## Key Insights` (with "Validated:" prefix)
- **Scope** answers → plan.md `## Constraints` (In Scope / Out of Scope)
- **Risk** answers → phase `## Risk Assessment`
- **Tradeoffs** answers → phase `## Key Insights`

Also:
- Add note: `"Validated: {answer summary}"` in phase overview
- If an answer reveals scope change, update plan.md Constraints

### 6e. Write Validation Log

Append `## Validation Log` section to plan.md (or update existing). Follow recording rules from `references/validation-questions.md`:

```markdown
### Q{N}: {full question text}
**Category:** {category}
**Options presented:** {list all options}
**Answer:** {selected option or custom text}
**Rationale:** {user's reasoning if provided, or "—"}
**Impact:** {which phase sections were updated}
```

## Output

- Phase files updated with validated decisions
- Risk assessments updated where applicable

## Next

Read and follow `step-07-gate.md`
