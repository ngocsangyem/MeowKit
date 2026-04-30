# Step 03b — Whole-Plan Consistency Sweep

## Contents

- This step (no further references)
- Inputs from `step-03-triage.md`: triaged findings (current-change vs incidental)
- Outputs to `step-04-verdict.md`: `sweep_failures` field appended to verdict context

## When to Run

Runs ONLY if a plan exists at `tasks/plans/<active-plan-dir>/`. Skip silently if no active plan (the review may be ad-hoc).

## Why

Distributed plans (`plan.md` + N × `phase-*.md`) can drift after edits — one phase gets renamed, phase-2 still references the old name. Cross-file contradictions hide because each phase looks self-consistent.

The triage step (03) categorizes findings within the diff. The sweep checks whether plan files themselves agree with each other and with the diff.

## Procedure

### 1. Locate the active plan

```bash
PLAN_DIR=$(cat session-state/active-plan 2>/dev/null)
[ -z "$PLAN_DIR" ] && echo "No active plan; skipping sweep" && exit 0
[ -d "$PLAN_DIR" ] || { echo "Active plan dir missing: $PLAN_DIR"; exit 0; }
```

### 2. Re-read every plan file

Read `plan.md` and every `phase-*.md`. Build a mental map of:
- Named entities (function/class/file/API names)
- Scope decisions (in-scope, out-of-scope)
- Acceptance criteria phrasings
- Dependency declarations

### 3. Build a delta list

For each entity that was renamed, deleted, or scope-changed during the current review:
- The diff shows the new name/scope
- Some phase files may still reference the old form

Record entries as:
```
RENAMED:    old_name → new_name        (mentioned in: plan.md, phase-02.md)
DROPPED:    feature_X                  (still referenced in: phase-04.md, phase-06.md)
SCOPE-CHANGE: out-of-scope → in-scope  (phase-01.md needs reconciliation)
```

### 4. Reconcile across files

For each delta entry: grep every plan file. Where a stale reference is found:
- Note the file + line
- Add to `sweep_failures` list

### 5. Emit findings

Sweep failure does NOT auto-FAIL the verdict. It surfaces a `sweep_failures` field that step-04-verdict appends to its output:

```
sweep_failures:
  - phase-02.md:18  references old `userController` (renamed to `authController` in this diff)
  - phase-04.md:42  still in-scope per plan, but diff removes the related route
```

The reviewer agent flags these to the human as "plan-file inconsistency, fix before next phase." It is informational, not blocking.

## Interaction With Other Steps

- **Triage (03)** — runs first. Sweep operates on triaged findings + plan files.
- **Verdict (04)** — receives `sweep_failures`. The verdict may reference them under "next steps" but does NOT downgrade per-dimension grades because of sweep findings. Hard-fail dimensions remain the only auto-FAIL signal.

## Skip Conditions

Skip silently when:
- No active plan in `session-state/active-plan`
- Plan dir does not exist
- Plan has only `plan.md` and no phase files (single-file plans cannot drift cross-file)

## Source

Adapted from claudekit-engineer v2.17 `verification-roles.md` "Whole-Plan Consistency Sweep" section.

## Next

Read and follow `step-04-verdict.md`.
