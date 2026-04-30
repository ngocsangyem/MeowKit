# Step 8: Hydrate Tasks

Create Claude Tasks from plan phases for session-scoped execution tracking.

## Instructions

### 8a. Skip Check

Skip task hydration if:
- Less than 3 phases (overhead exceeds benefit)
- Task tools unavailable (VSCode extension) — plan files are the source of truth

### 8b. Create Tasks from Phases

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

### 8c. Set Dependencies + Critical-Step Tasks

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

**Parallel Group Hydration** (conditional: `planning_mode = parallel`)

Read `## Execution Strategy` from plan.md to determine groups:
- Phases in the **same parallel group**: NO `addBlockedBy` between them.
- Phases in a **later group**: `addBlockedBy` the last phase task ID of the prior group.
- Add `parallel_group: "{letter}"` to each task's metadata.

**Two-Approach Hydration** (conditional: `planning_mode = two`)

Hydrate tasks ONLY from the selected approach's phase files (`selected_approach = "a"` or `"b"`).
Do NOT create tasks for the archived (non-selected) approach.

### 8d. Create Checkpoint File

Write `{plan_dir}/.plan-state.json` for cross-session resilience:

```json
{
  "version": "1.1",
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
  "selected_approach": "a"
}
```

`tasks_total` = count of `- [ ]` checkboxes in the phase file.

Fields `parallel_groups` and `selected_approach` are **optional** — omit when not applicable:
- `parallel_groups`: only set when `planning_mode = parallel`
- `selected_approach`: only set when `planning_mode = two`

Consumers reading `.plan-state.json` MUST handle unknown/missing fields gracefully (access only known keys).

### 8e. Output Cook Command

Print the Context Reminder block (from `references/gate-1-approval.md`) with:
- Absolute path to plan.md
- Mode-matched cook flag

**STOP after this step. Do not auto-proceed to implementation.**

## Output

- `{N}` tasks created with dependency chain
- `.plan-state.json` checkpoint created
- Cook command printed with absolute path

## CEO Review Suggestion

After printing the cook command, check `planning_mode` from `.plan-state.json`:

```
If planning_mode in [hard, deep, parallel, two, product-level]:
  Print: "📋 Recommend: /mk:plan-ceo-review {plan-path} — strategic review before implementation."
Else:
  Print: "📋 Optional: /mk:plan-ceo-review {plan-path} — strategic review."
```

## Next

STOP. User runs `/mk:cook {path}` to begin implementation, or `/mk:plan-ceo-review {path}` for strategic review first.
