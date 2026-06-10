# Task Management & Hydration

## Plan → Task Bridge

Plans are persistent files; session tasks are scoped to the current session — they vanish when the session ends. Hydration bridges the two: read each `[ ]` from phase files, emit one `TaskCreate` per unchecked item. Sync-back closes the loop on completion: `[ ]` → `[x]` and frontmatter status update.

**Tool availability:** `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList` are CLI-only — they may be unavailable in non-TTY agentic host environments (e.g., GUI editor extensions). If these tools error, fall back to `TodoWrite`. Plan files remain the source of truth; hydration is an optimization, not a requirement.

## Hydration Rules
- Create TaskCreate per phase with `addBlockedBy` chain
- Skip if < 3 phases (overhead exceeds benefit)
- Each task: subject, description, phase metadata

### Hydration Pattern Details

**Metadata Template** — every `TaskCreate` MUST include these 5 fields:

```
metadata: {
  phase: {N},                       # integer, mirrors phase frontmatter
  priority: "P1|P2|P3",             # mirrors phase frontmatter
  effort: "{estimate}",             # "1h", "30m", "2d"
  planDir: "{plan_dir}",            # workspace-relative path
  phaseFile: "phase-{NN}-{name}.md" # filename only
}
```

**Critical-Step Sub-Tasks** — scan each phase's `## Todo List` for items prefixed `[CRITICAL]` or `[HIGH]`. Per match, create a sub-task:

```
TaskCreate:
  subject: "Phase {N} — {step description}"
  metadata: { step: true, critical: true, riskLevel: "high", phaseFile: "..." }
  addBlockedBy: [parent phase task ID]
```

Only marked items become sub-tasks. Most todos stay at phase level.

**Parallel-Group Rules** (active only when `planning_mode = parallel`):

- Within-group: phases in the same parallel group have NO `addBlockedBy` between them
- Cross-group: phases in a later group `addBlockedBy` the last phase task ID of the prior group
- Add `parallel_group: "{letter}"` to each task's metadata

**Two-Approach Filter** (active only when `planning_mode = two`): hydrate tasks ONLY from the selected approach's phase files (`selected_approach = "a"` or `"b"`). Do NOT create tasks for the archived (non-selected) approach.

## Post-Hydration Integrity Checks

After hydration completes, run three checks. Any failure is a hard STOP — do NOT auto-recover, do NOT silently continue.

1. **Cycle check** — walk every task's `addBlockedBy` chain; assert no node reaches itself. Cycles indicate malformed dependency declarations (e.g., Phase X declares Y as a dep AND Phase Y declares X).
2. **Count-match check** — sum of unchecked `[ ]` items across all `phase-XX-*.md` files MUST equal the number of session tasks created (phase tasks + critical-step sub-tasks). Drift indicates a phase file changed between scaffolding and hydration, or a `[CRITICAL]` token was added without a sub-task.
3. **Metadata-completeness check** — every `TaskCreate` call has all 5 required fields (`phase`, `priority`, `effort`, `planDir`, `phaseFile`). Missing fields break cross-session resume.

**Success log (on all-pass):**

```
✓ Hydrated [N] phase tasks + [M] critical step tasks with dependency chain
```

**Failure mode (on any check failure):** print explicit diff and STOP. Do NOT proceed to step-09.

```
✗ Integrity check failed: expected N tasks, found M
   Missing: phase-XX-foo.md (or specific TaskCreate call missing field "phaseFile")
   Required: human resolution before proceeding.
```

❌ Anti-pattern — auto-recover by inferring missing tasks from phase files. Hydration state must be human-reviewed; silent recovery hides scaffolding drift.

N=0 / M=0 is PASS (no-op): zero phases legitimately means zero tasks; only mismatches trigger STOP.

## Cross-Session Resume
New session → read plan.md → check `[ ]` items → re-hydrate unchecked items as tasks.
Already `[x]` items → skip.

## Sync-Back (on completion)
1. Mark session tasks complete via `TaskUpdate`
2. Update phase files: `[ ]` → `[x]` for completed items
3. Update plan.md status table
4. If every non-abandoned phase todo is checked and at least one todo exists, set plan frontmatter `status: completed` and move the plan directory to `tasks/plans/archive/{plan-name}/`
5. Project-manager agent sweeps all phase files

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
- Auto-archive never waits for `mk:ship`; completed task checkboxes are the source of truth for plan completion.
- `active` is HUMAN-ONLY — sync-back never writes `active`. The algorithm produces `pending`, `in_progress`, or `completed`. If a human marks a phase `active`, sync-back may demote it to `pending` when no todos are checked. (Use `in_progress` instead — it survives sync-back as long as at least one todo is checked.)
- Frontmatter is source of truth. The Overview block (`**Status:** ...`) is regenerated from frontmatter on every sync-back, NOT vice versa.
- Idempotent: re-running sync-back on an unchanged file produces zero diff.

### Procedure (operational)

1. Read `{plan_dir}/.plan-state.json`
2. For each phase file: apply the algorithm above to derive `new_status` and rewrite frontmatter
3. Regenerate the Overview mirror lines from frontmatter values
4. Update plan.md Phases table status column from checkpoint
5. Run the completion lifecycle check: if all task checkboxes across non-abandoned phase files are checked, set `plan.md` frontmatter `status: completed` and move the entire plan directory to `tasks/plans/archive/{plan-name}/`
6. project-manager subagent sweeps all phase-XX files for cross-file consistency
7. Git commit captures state transition

### Anti-patterns

- ❌ "Stamp at creation" — writing `status: completed` when scaffolding the phase file. Defeats Gate 1, breaks cook re-hydration (phases skip as "completed"), corrupts orchviz visualization.
- ❌ "Stamp completed without counting `[x]`" — drift between frontmatter and todo state. Validator (`scripts/validate-plan.py`) catches this with a hard error.

### Cross-Skill Notes

- **`mk:plan-ceo-review`**: reads phase files for review; YAML frontmatter is informational and parsed by FAILSAFE_SCHEMA — safe to ignore for ceo-review's prose analysis.
- **`mk:review` step-03b whole-plan-sweep**: gains a NEW drift surface — `dependencies: [N]` array. The sweep flags stale phase-number references when phases are renumbered/removed; this is informational, not blocking.

**Cross-Session Resume:**
New session → read `.plan-state.json` → skip completed phases → re-hydrate only pending phases as tasks.

## Status Producer/Consumer Matrix

The phase status enum has 7 values. Each has a documented producer (who writes it) and consumer (who reads it). Sync-back is constrained to write only 3 of these; the remaining 4 are either human-only or parse-failure sentinels.

| Status | Producer | Consumer | Citation |
|---|---|---|---|
| `pending` | sync-back algorithm (default when no todos checked); scaffolding (initial state) | cook re-hydration; orchviz | task-management.md "Algorithm (formal)" |
| `in_progress` | sync-back algorithm (some but not all todos checked) | cook re-hydration; orchviz | task-management.md "Algorithm (formal)" |
| `completed` | sync-back algorithm (all todos checked AND total > 0) | cook re-hydration (skip phase); orchviz; archive workflow | task-management.md "Algorithm (formal)" |
| `active` | HUMAN edit only — sync-back NEVER writes `active` | cook re-hydration; orchviz | task-management.md "Invariants" |
| `failed` | HUMAN edit only — terminal state | cook re-hydration (skip phase); orchviz; journal-writer | task-management.md "Invariants" |
| `abandoned` | HUMAN edit only — terminal state | cook re-hydration (skip phase); orchviz; archive workflow | task-management.md "Invariants" |
| `unknown` | parser cascade fallback — emitted only when `status:` is absent or unrecognized; never written from frontmatter | orchviz (display as warning); validator | internal sentinel |

## Cook Handoff
After Gate 1: output cook command with absolute path:
```bash
/mk:cook /absolute/path/to/plans/YYMMDD-name/plan.md
```
