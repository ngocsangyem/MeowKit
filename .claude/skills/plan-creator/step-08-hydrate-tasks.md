# Step 8: Hydrate Tasks

Create session tasks from plan phases for session-scoped execution tracking.

## Instructions

### 8a. Skip Check

Skip task hydration if:
- Less than 3 phases (overhead exceeds benefit)
- Task tools unavailable (GUI editor extensions) — plan files are the source of truth

Skipping hydration skips only the TaskCreate calls (8b/8c). The §8d checkpoint
(`.plan-state.json`, including PRESERVING the CLI-written `visual` block for
`visual_requirement != none` plans) still runs regardless.

### 8b. Create Tasks from Phases

For each phase in plan.md, create one TaskCreate. For the metadata schema (5 required fields), see `references/task-management.md` "Hydration Pattern Details > Metadata Template" — single source of truth.

### 8c. Set Dependencies + Critical-Step Tasks

Chain phases with `addBlockedBy`:
- Phase 2 blockedBy Phase 1 (if Phase 2 depends on Phase 1)
- Follow the "Depends On" column from plan.md phase table

**Critical-step tasks:** scan each phase's `## Todo List` for `[CRITICAL]`/`[HIGH]` items and create one sub-task per match (only marked items become sub-tasks). For the sub-task pattern and metadata shape, see `references/task-management.md` "Hydration Pattern Details > Critical-Step Sub-Tasks".

**TDD RED tasks:** when `tdd_mode = true`, scan each phase's `## Tests Before` section for unchecked checkboxes and create critical sub-tasks with metadata `{ step: true, critical: true, riskLevel: "red", phaseFile: "..." }`. Attach each to the owning phase task. Do not create a separate task hierarchy.

**Parallel Group Hydration** (active only when `planning_mode = parallel`): read `## Execution Strategy` from plan.md to determine groups. For the within-group / cross-group `addBlockedBy` rules and metadata, see `references/task-management.md` "Hydration Pattern Details > Parallel-Group Rules".

**Two-Approach Hydration** (active only when `planning_mode = two`): hydrate tasks ONLY from the selected approach's phase files using the `selected_approach` variable (`"a"` or `"b"`). For the selective-hydration filter, see `references/task-management.md` "Hydration Pattern Details > Two-Approach Filter".

### 8d. Create Checkpoint File

#### Status Read Order (Required)

When populating `phases[*].status` in `.plan-state.json`, read in this order (mirrors the phase-file parser cascade):

1. Frontmatter `status:` field (PREFERRED)
2. `**Status:**` bold pattern in `## Overview` (legacy fallback)
3. Plain `status: ...` regex anywhere in body (deeper fallback)
4. `unknown` sentinel (parse-failure indicator — never written from frontmatter)

New plans always have frontmatter, so step 1 resolves immediately. Legacy plans created before this skill upgrade fall through to step 2.

Write `{plan_dir}/.plan-state.json` for cross-session resilience:

```json
{
  "version": "1.3",
  "created": "{YYYYMMDD-HHMM}",
  "planning_mode": "{fast|hard|deep|parallel|two|product-level}",
  "scope_mode": "{EXPANSION|HOLD|REDUCTION}",
  "phases": {
    "phase-01-name": { "status": "pending", "tasks_completed": 0, "tasks_total": N },
    "phase-02-name": { "status": "pending", "tasks_completed": 0, "tasks_total": N }
  },
  "parallel_groups": {
    "Setup": ["phase-01-name"],
    "A": ["phase-02-name", "phase-03-name"],
    "B": ["phase-04-name"]
  },
  "selected_approach": "a",
  "verification_tier": "standard",
  "consistency_sweeps_passed": { "red_team": true, "validation": true },
  "visual": {
    "schema": "visual-plan/v1",
    "path": "visual-plan/plan.json",
    "revision": 4,
    "hash": "sha256:...",
    "source_plan_hash": "sha256:...",
    "review_status": "approved",
    "pending_feedback": []
  }
}
```

**v1.3 schema notes (additive, reader-compatible).** The `visual` block is NEW in
v1.3 and present ONLY when `visual_requirement != none`. It is CLI-MANAGED: written
by `mewkit visual-plan approve`/`rehash` (which do read-modify-write, preserving
every other field). Do NOT hand-write it. Because `approve` already ran at step-07,
this step MUST PRESERVE the existing `visual` block — read the current
`.plan-state.json`, keep its `visual` key verbatim, and write your other fields
around it (never clobber it). For `none` plans, omit `visual` entirely. See
`references/visual-plan-integration.md` §8.

**v1.2 fields still apply.** `verification_tier` and `consistency_sweeps_passed`
(v1.2) remain optional-and-additive. All readers MUST treat unknown/missing fields
as optional (default `null`/`{}`), so legacy v1.1/v1.2 plan-state files still load.
The schema is additive only; no existing field is renamed or removed.

`tasks_total` = count of `- [ ]` checkboxes in the phase file.
`status` value above is resolved via the cascade in `### Status Read Order`.

Fields `parallel_groups` and `selected_approach` are **optional** — omit when not applicable:
- `parallel_groups`: only set when `planning_mode = parallel`
- `selected_approach`: only set when `planning_mode = two`

Consumers reading `.plan-state.json` MUST handle unknown/missing fields gracefully (access only known keys).

### 8e. CEO Review Suggestion

Check `planning_mode` from `.plan-state.json`:

```
If planning_mode in [hard, deep, parallel, two, product-level]:
  Print: "📋 Recommend: /mk:plan-ceo-review {plan-path} — strategic review before implementation."
Else:
  Print: "📋 Optional: /mk:plan-ceo-review {plan-path} — strategic review."
```

The Context Reminder block and the cook-command print are now emitted by `step-09-post-plan-handoff.md` AFTER the user selects a next-step. Do NOT print them here.

### 8f. Post-Hydration Integrity Checks

Run the three checks defined in `references/task-management.md` "Post-Hydration Integrity Checks":

1. Cycle check — walk `addBlockedBy` chains; assert no node reaches itself
2. Count-match check — sum of unchecked `[ ]` across all `phase-XX-*.md` files MUST equal session tasks created (phase tasks + critical-step sub-tasks)
3. Metadata-completeness check — every `TaskCreate` call carries all 5 required fields (`phase`, `priority`, `effort`, `planDir`, `phaseFile`)

**All-pass** → continue to Output and emit the success-log line.

**Any-fail** → print explicit diff and STOP. Do NOT proceed to step-09. Example:

```
✗ Integrity check failed: expected 5 tasks (3 phases + 2 critical steps), found 4
   Missing: critical step "[CRITICAL] migrate users table" in phase-02-database.md
   Required: human resolution before proceeding.
```

N=0 / M=0 is PASS no-op (zero phases legitimately means zero tasks); only mismatches trigger STOP.

## Output

On integrity-check pass, emit:
`✓ Hydrated [N] phase tasks + [M] critical step tasks with dependency chain`

Also: `.plan-state.json` checkpoint created.

## Next

- If `html_mode = true` → read and follow `step-08b-html-render.md` (renders `plan.html`, then chains to step-09).
- Otherwise → read and follow `step-09-post-plan-handoff.md`.
