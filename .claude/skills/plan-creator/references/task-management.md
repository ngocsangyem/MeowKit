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

After implementation completes, cook's finalize step MUST run sync-back per the **Algorithm** below.

### Algorithm (formal)

For each phase file (ascending phase number):

```
todos = parse_checkboxes(file.body, section="## Todo List")
current_status = file.frontmatter.status

# Terminal states: never overwrite
if current_status in ("failed", "abandoned"):
    continue

total = len(todos)
checked = sum(1 for t in todos if t.checked)

if total == 0 or checked == 0:
    new_status = "pending"
elif checked < total:
    new_status = "in_progress"
else:
    new_status = "completed"

if new_status != current_status:
    write_frontmatter(file, status=new_status)
    regenerate_overview_mirror(file)  # **Status:**, **Priority:**, **Effort:**, **Depends on:**
```

**Invariants:**
- `status: completed` requires `total > 0 AND checked == total`. Empty todo lists never auto-promote.
- `failed` and `abandoned` are terminal — only a human edit moves out.
- `active` is HUMAN-ONLY — sync-back never writes `active`. The algorithm produces `pending`, `in_progress`, or `completed`. If a human marks a phase `active`, sync-back may demote it to `pending` when no todos are checked. (Use `in_progress` instead — it survives sync-back as long as at least one todo is checked.)
- Frontmatter is source of truth. The Overview block (`**Status:** ...`) is regenerated from frontmatter on every sync-back, NOT vice versa.
- Idempotent: re-running sync-back on an unchanged file produces zero diff.

### Procedure (operational)

1. Read `{plan_dir}/.plan-state.json`
2. For each phase file: apply the algorithm above to derive `new_status` and rewrite frontmatter
3. Regenerate the Overview mirror lines from frontmatter values
4. Update plan.md Phases table status column from checkpoint
5. project-manager subagent sweeps all phase-XX files for cross-file consistency
6. Git commit captures state transition

### Anti-patterns

- ❌ "Stamp at creation" — writing `status: completed` when scaffolding the phase file. Defeats Gate 1, breaks cook re-hydration (phases skip as "completed"), corrupts orchviz visualization.
- ❌ "Stamp completed without counting `[x]`" — drift between frontmatter and todo state. Validator (`scripts/validate-plan.py`) catches this with a hard error.

### Cross-Skill Notes

- **`mk:plan-ceo-review`**: reads phase files for review; YAML frontmatter is informational and parsed by FAILSAFE_SCHEMA — safe to ignore for ceo-review's prose analysis.
- **`mk:review` step-03b whole-plan-sweep**: gains a NEW drift surface — `dependencies: [N]` array. The sweep flags stale phase-number references when phases are renumbered/removed; this is informational, not blocking.

**Cross-Session Resume:**
New session → read `.plan-state.json` → skip completed phases → re-hydrate only pending phases as tasks.

## Cook Handoff
After Gate 1: output cook command with absolute path:
```bash
/mk:cook /absolute/path/to/plans/YYMMDD-name/plan.md
```
