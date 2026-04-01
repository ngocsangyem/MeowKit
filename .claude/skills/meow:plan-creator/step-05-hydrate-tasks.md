# Step 5: Hydrate Tasks

Create Claude Tasks from plan phases for session-scoped execution tracking.

## Instructions

### 5a. Skip Check

Skip task hydration if:
- Less than 3 phases (overhead exceeds benefit)
- Task tools unavailable (VSCode extension) — plan files are the source of truth

### 5b. Create Tasks from Phases

For each phase in plan.md:

```
TaskCreate:
  subject: "Phase {N}: {phase name}"
  description: "{phase overview from phase file}"
  metadata: {
    phase: {N},
    priority: "{P1|P2|P3}",
    effort: "{estimate}",
    planDir: "{plan_dir}",
    phaseFile: "phase-{NN}-{name}.md"
  }
```

### 5c. Set Dependencies + Critical-Step Tasks

Chain phases with `addBlockedBy`:
- Phase 2 blockedBy Phase 1 (if Phase 2 depends on Phase 1)
- Follow the "Depends On" column from plan.md phase table

**Critical-step tasks:** After phase-level tasks, scan each phase's Todo List:
- Items prefixed with `[CRITICAL]` or `[HIGH]` → create sub-tasks:
  ```
  TaskCreate:
    subject: "Phase {N} — {step description}"
    metadata: { step: true, critical: true, riskLevel: "high", phaseFile: "..." }
    addBlockedBy: [parent phase task ID]
  ```
- Only create sub-tasks for marked items (most todos stay at phase level)

### 5d. Create Checkpoint File

Write `{plan_dir}/.plan-state.json` for cross-session resilience:

```json
{
  "version": "1.0",
  "created": "{YYYYMMDD-HHMM}",
  "planning_mode": "{fast|hard}",
  "scope_mode": "{EXPANSION|HOLD|REDUCTION}",
  "phases": {
    "phase-01-name": { "status": "pending", "tasks_completed": 0, "tasks_total": N },
    "phase-02-name": { "status": "pending", "tasks_completed": 0, "tasks_total": N }
  }
}
```

`tasks_total` = count of `- [ ]` checkboxes in the phase file.

### 5e. Output Cook Command

Print the Context Reminder block (from `references/gate-1-approval.md`) with:
- Absolute path to plan.md
- Mode-matched cook flag

**STOP after this step. Do not auto-proceed to implementation.**

## Output

- `{N}` tasks created with dependency chain
- `.plan-state.json` checkpoint created
- Cook command printed with absolute path

## Next

STOP. User runs `/meow:cook {path}` to begin implementation.
