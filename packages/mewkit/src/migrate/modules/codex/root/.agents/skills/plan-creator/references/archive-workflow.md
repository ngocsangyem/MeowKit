# Archive Workflow

Subcommand: `the plan skill archive`. Manages plan lifecycle by archiving completed/cancelled plans.

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

Activated when argument is `archive` (e.g., `the plan skill archive`).

## Workflow

### A1. Scan Plans

Read `tasks/plans/` directory. For each subdirectory:
1. Read `plan.md` frontmatter `status` field
2. Collect plans where status is `completed` or `cancelled`
3. If no completed/cancelled plans found: print "No plans to archive." → STOP

### A2. Present Plan List

Via `stop and ask the user in chat`. Header: "Archive Plans". Question (composed): print "Found {N} archivable plans:" followed by the `name | status | created | phases` table, then "Which plans to archive?". Single-select.

| Option | Recommend When | Why |
|--------|----------------|-----|
| All completed + cancelled | Both classes are safely archivable in one shot | Archives all {N} plans |
| Completed only | Cancelled plans may still need post-mortem | Keeps cancelled for review |
| Select specific plans | User wants per-plan control (e.g., active reviewer is mid-read on one) | Multi-select follow-up prompt per plan |
| Cancel | User is exploring, not committing | Aborts without touching any plan |

If "Select specific plans": present each plan as a multi-select `stop and ask the user in chat`.
If "Cancel": STOP.

### A3. Journal Capture (Optional)

For each selected plan, ask via `stop and ask the user in chat`. Header: "Journal Capture". Question: "Capture learnings from these plans to memory before archiving?" Single-select.

| Option | Recommend When | Why |
|--------|----------------|-----|
| Yes — capture learnings | Plan has Red Team Review or Validation Log sections with decisions worth replaying | Appends key decisions and patterns to the canonical `.meowkit/memory/architecture-decisions.json` |
| No — just archive | Plan was trivial / experimental and has no reusable knowledge | Archives without capturing learnings |

If "Yes": for each selected plan, extract:
- Key decisions from plan.md (Goal, Constraints, Risk Assessment)
- Red Team findings (if Red Team Review section exists)
- Validation answers (if Validation Log section exists)

Append the entry to the CANONICAL store `.meowkit/memory/architecture-decisions.json` — NOT
the `.md` view (a `.md` write is invisible to JSON-first readers; see
`.agents/skills/rule-memory-read-rules.md` → Write Rules). Add to the `patterns` array (create the
file with the v2.0.0 skeleton if absent), bump `metadata.last_updated`, leave `version`:
```
id: archive-{plan-name}
type: decision
pattern: {goal from plan} — {1-2 bullet summary of key decisions}
context: learnings — {red-team findings, validation answers, 1-2 bullets}
status: archived-{completed|cancelled}
date: {date}
```
(Match the canonical shape `immediate-capture-handler.cjs` writes: `type` + `pattern` + `context`.)
If the write fails, print `⚠ memory capture skipped: <reason>` — do not skip silently.

### A4. Archive Action

Ask via `stop and ask the user in chat`. Header: "Archive Action". Question: "How to handle the archived plans?" Single-select.

| Option | Recommend When | Why |
|--------|----------------|-----|
| Archive | Plan may be useful later for reference, audit, or replay | Runs `npx mewkit plan archive`; preserves history in git |
| Delete | Plan is throwaway / sensitive / consumes repo space without value | Removes plan directories permanently (confirm before running rm) |

If "Archive": for each selected plan run `npx mewkit plan archive tasks/plans/{plan-name}` — it stamps `status: completed` across plan.md + every phase file and `.plan-state.json` (preserving the visual block), then moves the directory to `tasks/plans/archive/{plan-name}/`.
If "Delete": `rm -rf tasks/plans/{plan-name}` (confirm with user first)

### A5. Summary

Print summary table:

```
Archived {N} plans:
| Plan | Status | Action | Journal |
|------|--------|--------|---------|
| {name} | completed | moved to archive/ | yes |
```

### A6. Optional Commit

Ask if user wants to commit the archival changes.

## Rules

- NEVER touch plans with status `draft`, `in-progress`, or `pending`
- The manual `the plan skill archive` subcommand never archives without user confirmation. Completion-driven lifecycle archiving is separate and runs only after every plan todo is checked.
- `npx mewkit plan archive` creates `tasks/plans/archive/` if absent and fails closed if the destination already exists
- Journal capture is optional — respect user choice
