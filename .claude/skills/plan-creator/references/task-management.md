# Task Management & Hydration

## Contents

- [Plan → Task Bridge](#plan--task-bridge)
- [Hydration Rules](#hydration-rules)
- [Post-Hydration Integrity Checks](#post-hydration-integrity-checks)

## Plan → Task Bridge

Plans are persistent files; session tasks are scoped to the current session — they vanish when the session ends. Hydration bridges the two: read each `[ ]` from phase files, create one tracked task per unchecked item.

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

## After hydration

Resume, sync-back (`mewkit plan sync {plan-dir}`), the status matrix and archive belong to `mk:cook`: see `.claude/skills/cook/references/workflow-steps.md`. `mewkit plan sync` only updates an existing `.plan-state.json` and never creates one, so plan-creator does not write it.
