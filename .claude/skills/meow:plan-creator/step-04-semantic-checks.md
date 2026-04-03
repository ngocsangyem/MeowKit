# Step 4: Semantic Checks

Semantic quality checks and structural validation. Runs in all modes.

## Instructions

### 4a. Semantic Content Checks (All Modes)

Check the plan.md and fix inline if any fail:

| Check | Pass | Fail (fix it) |
|-------|------|---------------|
| Goal is outcome | "Users can log in with OAuth" | "Implement OAuth flow" → rewrite |
| ACs are binary | `- [ ] Login returns JWT token` | "Code is clean" → make specific |
| Constraints non-empty | Has ≥1 constraint | Empty → add "MUST preserve existing tests" |
| ≥1 risk identified | Risk table has entries | Empty → add at least 1 risk |
| plan.md ≤80 lines | Under limit | Over → move detail to phase files |

### 4b. Structural Validation

Run the validation script:
```bash
.claude/skills/.venv/bin/python3 .claude/skills/meow:plan-creator/scripts/validate-plan.py {plan_dir}/plan.md
```

Must output `PLAN_COMPLETE`. Fix reported issues before proceeding.

**Skip if:** `planning_mode = fast` — go directly to step-07-gate.md.

### 4c. Two-Approach Selection (conditional: `planning_mode = two`)

Run 4a and 4b semantic checks on BOTH `plan-approach-a.md` and `plan-approach-b.md`. Fix issues in each file independently. Then:

1. Read the `## Goal` line from each approach file for the summary.
2. Present via AskUserQuestion:

```json
{
  "questions": [{
    "question": "Select the implementation approach to proceed with",
    "header": "Approach Selection",
    "options": [
      { "label": "Approach A: {name from file}", "description": "{Goal line from plan-approach-a.md}" },
      { "label": "Approach B: {name from file}", "description": "{Goal line from plan-approach-b.md}" }
    ],
    "multiSelect": false
  }]
}
```

3. Based on user selection:
   - **Selected approach**: generate `plan.md` + `phase-XX-*.md` files from it (using templates in 3b/3c).
   - **Non-selected approach**: move file to `{plan_dir}/archived/`.
4. Set `selected_approach = "a"` or `"b"` in session state.
5. Print: `"Approach {X} selected. Archived non-selected. Proceeding to red-team."`

**Important:** Step-05 red-team reviews ONLY the selected approach's phase files.

## Output

- Semantic check results (pass/fail per row)
- `PLAN_COMPLETE` from validation script
- `selected_approach` set (two mode only)

## Next

If `planning_mode = fast` → read and follow `step-07-gate.md`
Otherwise → read and follow `step-05-red-team.md`
