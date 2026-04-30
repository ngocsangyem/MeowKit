# Task Management & Hydration

## Plan → Task Bridge
Plans are persistent files. Claude Tasks are session-scoped.
Hydration bridges the gap: create tasks from plan checkboxes.

## Hydration Rules
- Create TaskCreate per phase with `addBlockedBy` chain
- Skip if < 3 phases (overhead exceeds benefit)
- Each task: subject, description, phase metadata

## Cross-Session Resume
New session → read plan.md → check `[ ]` items → re-hydrate unchecked items as tasks.
Already `[x]` items → skip.

## Sync-Back (on completion)
1. Mark Claude Tasks complete via TaskUpdate
2. Update phase files: `[ ]` → `[x]` for completed items
3. Update plan.md status table
4. Project-manager agent sweeps all phase files

## Sync-Back Protocol (Executed by Cook's Finalize Step)

After implementation completes, cook's finalize step MUST run sync-back:

1. Read `{plan_dir}/.plan-state.json`
2. For each phase file: count `[x]` checkboxes → update `tasks_completed` in checkpoint
3. Update phase status: all todos done → "complete", partial → "in-progress", none → "pending"
4. Update plan.md phase table: sync status column from checkpoint
5. project-manager subagent sweeps all phase-XX files for consistency
6. Git commit captures state transition

**Cross-Session Resume:**
New session → read `.plan-state.json` → skip completed phases → re-hydrate only pending phases as tasks.

## Cook Handoff
After Gate 1: output cook command with absolute path:
```bash
/mk:cook /absolute/path/to/plans/YYMMDD-name/plan.md
```
