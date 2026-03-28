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

## Cook Handoff
After Gate 1: output cook command with absolute path:
```bash
/cook /absolute/path/to/plans/YYMMDD-name/plan.md
```
