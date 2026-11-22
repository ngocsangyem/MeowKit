# Task Management & Hydration

## Contents

- [Plan → Task Bridge](#plan--task-bridge)
- [Hydration Rules](#hydration-rules)
- [Post-Hydration Integrity Checks](#post-hydration-integrity-checks)
- [Cross-Session Resume](#cross-session-resume)
- [Sync-Back (on completion)](#sync-back-on-completion)
- [Sync-Back Protocol (Executed by Cook's Finalize Step)](#sync-back-protocol-executed-by-cooks-finalize-step)
- [Status Producer/Consumer Matrix](#status-producerconsumer-matrix)
- [Cook Handoff](#cook-handoff)

## Plan → Task Bridge

Plans are persistent files; session tasks are scoped to the current session — they vanish when the session ends. Hydration bridges the two: read each `[ ]` from phase files, create one tracked task per unchecked item. Sync-back closes the loop on completion: `[ ]` → `[x]` and frontmatter status update.

**Tool availability:** tracked-task creation/update/list/get may be CLI-only — unavailable in some non-TTY agentic host environments (e.g., GUI editor extensions). If unavailable, fall back to a plain to-do list. Plan files remain the source of truth; hydration is an optimization, not a requirement.

## Hydration Rules
- Create one tracked task per phase, each blocked-by its predecessor
- Skip if < 3 phases (overhead exceeds benefit)
- Each task: subject, description, phase metadata

### Hydration Pattern Details

**Metadata Template** — every created task MUST include these 5 fields:

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
task:
  subject: "Phase {N} — {step description}"
  metadata: { step: true, critical: true, riskLevel: "high", phaseFile: "..." }
  blockedBy: [parent phase task ID]
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
3. **Metadata-completeness check** — every created task has all 5 required fields (`phase`, `priority`, `effort`, `planDir`, `phaseFile`). Missing fields break cross-session resume.

**Success log (on all-pass):**

```
✓ Hydrated [N] phase tasks + [M] critical step tasks with dependency chain
```

**Failure mode (on any check failure):** print explicit diff and STOP. Do NOT proceed to step-09.

```
✗ Integrity check failed: expected N tasks, found M
   Missing: phase-XX-foo.md (or a specific created task missing field "phaseFile")
   Required: human resolution before proceeding.
```

❌ Anti-pattern — auto-recover by inferring missing tasks from phase files. Hydration state must be human-reviewed; silent recovery hides scaffolding drift.

N=0 / M=0 is PASS (no-op): zero phases legitimately means zero tasks; only mismatches trigger STOP.

## Cross-Session Resume
New session → read plan.md → check `[ ]` items → re-hydrate unchecked items as tasks.
Already `[x]` items → skip.

Archived plans under `tasks/plans/archive/` are out of bounds for reading: the shipped code is the source of truth for what was built, not an old plan.

## Sync-Back (on completion)
1. Mark session tasks complete
2. Update phase files: `[ ]` → `[x]` for completed items
3. Run `mewkit plan sync {plan-dir}` — it rewrites every derived status (phase frontmatter, `**Status:**` lines, the plan.md Phases table and status, `.plan-state.json`) from those checkboxes
4. If sync prints `plan complete`, archive the plan with `mewkit plan archive {plan-dir}` (stamps `status: completed` across plan.md + phase files + `.plan-state.json`, then moves the directory to `tasks/plans/archive/{plan-name}/`)
5. Project-manager agent sweeps all phase files

## Sync-Back Protocol (Executed by Cook's Finalize Step)

After implementation completes, cook's finalize step MUST run sync-back: tick the boxes, then run `mewkit plan sync {plan-dir}`, which applies the **Algorithm** below. `mewkit plan sync {plan-dir} --check` prints the drift without writing and exits 1 when there is any; `mewkit plan status` names the drift too.

Fallback: if the installed binary lacks `plan sync` (it prints an unrecognized-subcommand error), apply the Algorithm by hand to each phase file, the plan.md Phases table and status, and `.plan-state.json`.

### Algorithm (formal)

For each phase file (ascending phase number):

```
todos = parse_checkboxes(file.body, section="## Todo List")
current_status = file.frontmatter.status
total = len(todos)
checked = sum(1 for t in todos if t.checked)

if total > 0:
    plan_state.phases[file.stem].tasks_completed = checked   # facts: written even for
    plan_state.phases[file.stem].tasks_total = total         # a human-set phase

# Human-set states, or nothing to derive from: keep the status
if current_status in ("failed", "abandoned", "active") or total == 0:
    continue

if checked == 0:
    new_status = "pending"
elif checked < total:
    new_status = "in_progress"
else:
    new_status = "completed"

write_if_different(file.frontmatter.status, new_status)
write_if_different(file.overview["**Status:**"], new_status)    # whole value replaced
write_if_different(plan_md.phases_table[row linking file].status, new_status)  # whole cell
write_if_different(plan_state.phases[file.stem].status, new_status)

# plan.md status: never changed when failed, abandoned, cancelled or archived
plan_md.status = "completed"   if every non-abandoned phase is completed
                 "in-progress" elif any phase is past pending
                 unchanged     otherwise
```

A value that already says the derived status (ignoring case, quotes and a parenthesised note) is left exactly as written; one that differs is replaced whole, in the style it used (`In progress` beside capitals, else `in_progress`).

**Invariants:**
- Sync writes derived fields only; it never ticks or unticks a checkbox, never archives and never moves a file. The checkboxes are the single author.
- Only boxes inside `## Todo List` count. `status: completed` requires `total > 0 AND checked == total`. A phase with no todos keeps its status.
- `failed`, `abandoned` and `active` are human-set — only a human edit moves out. Sync produces `pending`, `in_progress`, or `completed`.
- Auto-archive never waits for `mk:ship`; completed task checkboxes are the source of truth for plan completion.
- Checkboxes are the source of truth; frontmatter, the Overview `**Status:**` line, the Phases table and `.plan-state.json` are regenerated from them, NOT vice versa.
- Idempotent: re-running sync-back on an unchanged plan produces zero diff.

### Procedure (operational)

1. Tick the completed items' boxes in the phase files
2. Run `mewkit plan sync {plan-dir}` (fallback: apply the algorithm above by hand)
3. Run the completion lifecycle check: if sync printed `plan complete` (every box across non-abandoned phase files is checked), archive the plan with `mewkit plan archive {plan-dir}` (stamps `status: completed` across plan.md + phase files + `.plan-state.json`, then moves the entire plan directory to `tasks/plans/archive/{plan-name}/`)
4. project-manager subagent sweeps all phase-XX files for cross-file consistency
5. Git commit captures state transition

### Anti-patterns

- ❌ "Stamp at creation" — writing `status: completed` when scaffolding the phase file. Breaks cook re-hydration (phases skip as "completed").
- ❌ "Stamp completed without counting `[x]`" — drift between frontmatter and todo state. The structural check (`mewkit plan check --structural`) catches this with a hard error.

### Cross-Skill Notes

- **`mk:plan-ceo-review`**: reads phase files for review; YAML frontmatter is informational and parsed by FAILSAFE_SCHEMA — safe to ignore for ceo-review's prose analysis.
- **`mk:review` step-03b whole-plan-sweep**: gains a NEW drift surface — `dependencies: [N]` array. The sweep flags stale phase-number references when phases are renumbered/removed; this is informational, not blocking.

**Cross-Session Resume (canonical source):**
New session → read plan.md / phase-file `[ ]` checkboxes (and the phase frontmatter `status`, which the Sync-Back Algorithm derives from those checkboxes) → skip completed phases → re-hydrate only unchecked/pending phases as tasks. This matches `## Cross-Session Resume` above — there is ONE canonical resume source.

`.plan-state.json` is a DERIVED convenience cache, NOT the authority: a consumer MAY read it to skip a scan, but MUST recompute from the checkboxes on any disagreement (checkboxes/frontmatter win). It is written at hydration and rewritten only by `mewkit plan sync` — never hand-mutated.

## Status Producer/Consumer Matrix

The phase status enum has 7 values. Each has a documented producer (who writes it) and consumer (who reads it). Sync-back is constrained to write only 3 of these; the remaining 4 are either human-only or parse-failure sentinels.

| Status | Producer | Consumer | Citation |
|---|---|---|---|
| `pending` | sync-back algorithm (default when no todos checked); scaffolding (initial state) | cook re-hydration | task-management.md "Algorithm (formal)" |
| `in_progress` | sync-back algorithm (some but not all todos checked) | cook re-hydration | task-management.md "Algorithm (formal)" |
| `completed` | sync-back algorithm (all todos checked AND total > 0) | cook re-hydration (skip phase); archive workflow | task-management.md "Algorithm (formal)" |
| `active` | HUMAN edit only — sync-back NEVER writes `active` | cook re-hydration | task-management.md "Invariants" |
| `failed` | HUMAN edit only — terminal state | cook re-hydration (skip phase); journal-writer | task-management.md "Invariants" |
| `abandoned` | HUMAN edit only — terminal state | cook re-hydration (skip phase); archive workflow | task-management.md "Invariants" |
| `unknown` | parser cascade fallback — emitted only when `status:` is absent or unrecognized; never written from frontmatter | validator | internal sentinel |

> `.plan-state.json` is deliberately absent from this matrix: its `status` / `tasks_completed` fields are DERIVED from the phase-file checkboxes (the authoritative producers above), written at hydration and rewritten by `mewkit plan sync`. Treat it as a regenerable cache, not a status producer — never hand-mutate it mid-run.

## Cook Handoff
Once the plan is agreed: output cook command with absolute path:
```bash
/mk:cook /absolute/path/to/plans/YYMMDD-name/plan.md
```
