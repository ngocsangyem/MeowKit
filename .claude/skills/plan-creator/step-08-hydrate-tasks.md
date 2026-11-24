# Step 8: Hydrate Tasks

Turn the agreed phases into session tasks. Done when the integrity checks pass, or hydration was skipped for a stated reason.

## 8a. Skip when

- fewer than 3 phases (the overhead exceeds the benefit), or `fast`, `spike` and `product-level` plans, which have no phase files to track; or
- the runtime has no task tools. The plan files stay the source of truth either way.

## 8b. Create

One tracked task per phase, blocked by its predecessor per the Depends On column. Metadata schema, critical-step sub-tasks (`[CRITICAL]` / `[HIGH]` todos), the parallel-group rule and the two-approach filter (hydrate only the selected approach's phases): `references/task-management.md`. With `tdd_mode`, add a critical sub-task for each unchecked box under `## Tests Before`, attached to its phase task.

## 8c. Integrity checks

Run the three checks in `references/task-management.md` (no cycle in the blocked-by chains; unchecked boxes equal tasks created; every task carries its five metadata fields). A failure stops here with a printed diff: do not recover by inferring tasks, because the drift is something a human should see. Zero phases and zero tasks passes.

Progress state is not written here. `.plan-state.json` is a cache that `mewkit plan sync` updates only where it already exists; the checkboxes in the phase files are the authority.

## Next

`step-09-post-plan-handoff.md`
