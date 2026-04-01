# Phase 8: Sync-Back + Cross-Session Resilience

## Context Links

- [Red-Team Report: Task Hydration](../reports/red-team-260401-2034-plan-creator-vs-ck-plan-comparison.md) — "meow: sync-back = NONE. ck: explicit protocol."
- [CK Task Management](../../../docs/claudekit-engineer/.claude/skills/ck-plan/references/task-management.md) — Sync-back protocol
- [MeowKit Session Continuation](../../.claude/skills/meow:session-continuation/SKILL.md) — Existing session state

## Overview

- **Priority:** P2
- **Status:** Pending
- **Effort:** ~2h
- **Depends on:** Phase 4 (step-05 hydration exists)
- **Description:** Add sync-back mechanism so completed tasks update plan checkboxes. Add checkpoint file for cross-session resume. Enables plans to survive session death.

## Key Insights

- Current state: if cook session dies mid-plan, tasks are lost. Next session re-reads plan.md but has no knowledge of what was completed.
- ck-plan solution: project-manager subagent sweeps phase files, reconciles `[ ]` → `[x]`, updates plan.md status.
- MeowKit already has `meow:session-continuation` skill with TOON-based state. Use it for checkpoint persistence.
- Sync-back should be triggered by cook's finalize step, not plan-creator. But plan-creator must DESIGN the checkpoint format.

## Requirements

### Functional
1. **Checkpoint file:** `{plan-dir}/.plan-state.json` created at step-05 (hydration):
   ```json
   {
     "version": "1.0",
     "created": "YYYYMMDD-HHMM",
     "phases": {
       "phase-01-name": { "status": "pending", "tasks_completed": 0, "tasks_total": 5 },
       "phase-02-name": { "status": "pending", "tasks_completed": 0, "tasks_total": 3 }
     },
     "scope_mode": "HOLD",
     "planning_mode": "hard"
   }
   ```
2. **Sync-back protocol** (executed by cook's finalize, documented by plan-creator):
   - Read `.plan-state.json`
   - For each phase: count `[x]` checkboxes in phase file → update `tasks_completed`
   - Update phase status: all done → "complete", partial → "in-progress"
   - Update plan.md phase table statuses from checkpoint
3. **Cross-session resume:** New session reads `.plan-state.json` → knows which phases are done → re-hydrates only pending phases as tasks

### Non-Functional
- Checkpoint file is lightweight (<1 KB)
- Sync-back protocol is documented in step-05, executed by cook
- Compatible with meow:session-continuation

## Architecture

### Checkpoint Lifecycle

```
step-05 (hydrate) → CREATE .plan-state.json (initial state)
    ↓
cook (implementation) → UPDATE .plan-state.json per phase completion
    ↓
cook (finalize) → SYNC-BACK: checkbox reconciliation → plan.md status update
    ↓
new session → READ .plan-state.json → resume from last checkpoint
```

## Related Code Files

### Files to Modify
- `meowkit/.claude/skills/meow:plan-creator/step-05-hydrate-tasks.md` — Create checkpoint file
- `meowkit/.claude/skills/meow:plan-creator/references/task-management.md` — Document sync-back protocol

### Files to Read
- `meowkit/.claude/skills/meow:session-continuation/SKILL.md` — TOON state format

## Implementation Steps

1. Update step-05: after task creation, write `.plan-state.json` with initial phase states
2. Update references/task-management.md: document sync-back protocol for cook's finalize step
3. Add resume logic to step-00: if `.plan-state.json` exists in active plan dir, read it and skip completed phases
4. Test: checkpoint created after hydration
5. Test: new session reads checkpoint and skips completed phases

## Todo List

- [ ] Create .plan-state.json in step-05 after task hydration
- [ ] Document sync-back protocol in task-management.md
- [ ] Add checkpoint resume logic to step-00
- [ ] Test: checkpoint file created with correct structure
- [ ] Test: new session resumes from checkpoint

## Success Criteria

1. `.plan-state.json` created at plan hydration with correct phase map
2. Sync-back protocol documented (cook's responsibility to execute)
3. New session reads checkpoint and skips completed phases
4. Checkpoint file <1 KB

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Checkpoint out of sync with plan files | M | M | Sync-back reconciles from checkbox state (source of truth) |
| .plan-state.json corrupted | L | L | JSON; easy to regenerate from phase files |

## Security Considerations

N/A — checkpoint contains plan metadata only, no secrets.

## Next Steps

- Phase 9: critical-step tasks use checkpoint for finer-grained progress tracking
