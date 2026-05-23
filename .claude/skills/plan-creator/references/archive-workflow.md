# Archive Workflow

Subcommand: `/mk:plan archive`. Manages plan lifecycle by archiving completed/cancelled plans.

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

Activated when argument is `archive` (e.g., `/mk:plan archive`).

## Workflow

### A1. Scan Plans

Read `tasks/plans/` directory. For each subdirectory:
1. Read `plan.md` frontmatter `status` field
2. Collect plans where status is `completed` or `cancelled`
3. If no completed/cancelled plans found: print "No plans to archive." → STOP

### A2. Present Plan List

Via `AskUserQuestion`. Header: "Archive Plans". Question (composed): print "Found {N} archivable plans:" followed by the `name | status | created | phases` table, then "Which plans to archive?". Single-select.

| Option | Recommend When | Why |
|--------|----------------|-----|
| All completed + cancelled | Both classes are safely archivable in one shot | Archives all {N} plans |
| Completed only | Cancelled plans may still need post-mortem | Keeps cancelled for review |
| Select specific plans | User wants per-plan control (e.g., active reviewer is mid-read on one) | Multi-select follow-up prompt per plan |
| Cancel | User is exploring, not committing | Aborts without touching any plan |

If "Select specific plans": present each plan as a multi-select `AskUserQuestion`.
If "Cancel": STOP.

### A3. Journal Capture (Optional)

For each selected plan, ask via `AskUserQuestion`. Header: "Journal Capture". Question: "Capture learnings from these plans to memory before archiving?" Single-select.

| Option | Recommend When | Why |
|--------|----------------|-----|
| Yes — capture learnings | Plan has Red Team Review or Validation Log sections with decisions worth replaying | Appends key decisions and patterns to `.claude/memory/architecture-decisions.md` |
| No — just archive | Plan was trivial / experimental and has no reusable knowledge | Archives without capturing learnings |

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

Ask via `AskUserQuestion`. Header: "Archive Action". Question: "How to handle the archived plans?" Single-select.

| Option | Recommend When | Why |
|--------|----------------|-----|
| Move to .archive/ | Plan may be useful later for reference, audit, or replay | Moves to `tasks/plans/.archive/{plan-name}/`; preserves history in git |
| Delete | Plan is throwaway / sensitive / consumes repo space without value | Removes plan directories permanently (confirm before running rm) |

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