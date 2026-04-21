# Archive Workflow

Subcommand: `/meow:plan archive`. Manages plan lifecycle by archiving completed/cancelled plans.

## Contents

- [Trigger](#trigger)
- [Workflow](#workflow)
  - [A1. Scan Plans](#a1-scan-plans)
  - [A2. Present Plan List](#a2-present-plan-list)
  - [A3. Journal Capture (Optional)](#a3-journal-capture-optional)
- [Archive: {plan-name} ({date})](#archive-plan-name-date)
  - [A4. Archive Action](#a4-archive-action)
  - [A5. Summary](#a5-summary)
  - [A6. Optional Commit](#a6-optional-commit)
- [Rules](#rules)


## Trigger

Activated when argument is `archive` (e.g., `/meow:plan archive`).

## Workflow

### A1. Scan Plans

Read `tasks/plans/` directory. For each subdirectory:
1. Read `plan.md` frontmatter `status` field
2. Collect plans where status is `completed` or `cancelled`
3. If no completed/cancelled plans found: print "No plans to archive." → STOP

### A2. Present Plan List

Via AskUserQuestion:

```json
{
  "questions": [{
    "question": "Found {N} archivable plans:\n\n{table: name | status | created | phases}\n\nWhich plans to archive?",
    "header": "Archive Plans",
    "options": [
      { "label": "All completed + cancelled", "description": "Archive all {N} plans" },
      { "label": "Completed only", "description": "Archive only completed plans, keep cancelled for review" },
      { "label": "Select specific plans", "description": "Choose which plans to archive" },
      { "label": "Cancel", "description": "Don't archive anything" }
    ],
    "multiSelect": false
  }]
}
```

If "Select specific plans": present each plan as a multi-select AskUserQuestion.
If "Cancel": STOP.

### A3. Journal Capture (Optional)

For each selected plan, ask:

```json
{
  "questions": [{
    "question": "Capture learnings from these plans to memory before archiving?",
    "header": "Journal Capture",
    "options": [
      { "label": "Yes — capture learnings", "description": "Append key decisions and patterns to .claude/memory/architecture-decisions.md" },
      { "label": "No — just archive", "description": "Archive without capturing learnings" }
    ],
    "multiSelect": false
  }]
}
```

If "Yes": for each selected plan, extract:
- Key decisions from plan.md (Goal, Constraints, Risk Assessment)
- Red Team findings (if Red Team Review section exists)
- Validation answers (if Validation Log section exists)

Append to `.claude/memory/architecture-decisions.md`:
```markdown
## Archive: {plan-name} ({date})
- **Goal:** {goal from plan}
- **Key decisions:** {1-2 bullet summary}
- **Learnings:** {red-team findings, validation answers — 1-2 bullets}
- **Status:** archived-{completed|cancelled}
```

### A4. Archive Action

Ask:

```json
{
  "questions": [{
    "question": "How to handle the archived plans?",
    "header": "Archive Action",
    "options": [
      { "label": "Move to .archive/", "description": "Move to tasks/plans/.archive/{plan-name}/ (preserves in git)" },
      { "label": "Delete", "description": "Remove plan directories permanently" }
    ],
    "multiSelect": false
  }]
}
```

If "Move": `mv tasks/plans/{plan-name} tasks/plans/.archive/{plan-name}`
If "Delete": `rm -rf tasks/plans/{plan-name}` (confirm with user first)

### A5. Summary

Print summary table:

```
Archived {N} plans:
| Plan | Status | Action | Journal |
|------|--------|--------|---------|
| {name} | completed | moved to .archive/ | yes |
```

### A6. Optional Commit

Ask if user wants to commit the archival changes.

## Rules

- NEVER touch plans with status `draft`, `in-progress`, or `pending`
- NEVER auto-archive without user confirmation
- ALWAYS create `.archive/` directory if it doesn't exist (on move action)
- Journal capture is optional — respect user choice