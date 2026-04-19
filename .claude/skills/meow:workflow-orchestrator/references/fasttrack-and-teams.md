<!-- Extracted from SKILL.md for progressive disclosure (checklist #11, #14) -->

# Fast-Track Mode & Agent Teams

## Fast-Track Mode

**When:** User provides complete specs. Skips Phase 1, auto-executes Phases 2-5 without approval gates.

**Triggers:** `fasttrack: <specs>` | `workflow:fasttrack <file>` | "just build it"

### Required Spec Sections

Overview, Requirements, Technical Design, API/Interfaces, Data Model, Acceptance Criteria. If missing: ask user.

### Execution: Phase 2 → 3 → 4 → 5 (no approval gates, stops only on errors)

| Condition                   | Phase | Action                           |
| --------------------------- | ----- | -------------------------------- |
| Tests pass in RED           | 2     | Stop — specs may be incomplete   |
| Tests fail after 3 attempts | 3     | Stop — ask user                  |
| Critical security issue     | 4     | Stop — fix before proceeding     |
| Coverage below 80%          | 5     | Add tests, retry twice, then ask |
| Token limit warning         | Any   | Save state and handoff           |

### Switching: standard → fasttrack ("approve phase 1, then fasttrack"), fasttrack → standard (on error, auto-switches)

## Agent Teams Mode (Experimental)

**Gate:** ONLY for Deep complexity with 2+ domains scoring >=50. Quick/Standard use single-agent.

### Phase Team Composition

```toon
phase_teams[5]{phase,lead,teammates,team_size}:
  1-Understand+Design,planner → architect,developer+tester,3
  2-Test (RED if --tdd),tester,architect,2
  3-Build (GREEN if --tdd),architect,developer+tester,3
  4-Refactor+Review,architect+security,reviewer,3
  5-Finalize,orchestrator,-,1
```

### Operation Pattern

1. Read team config → 2. TaskList unclaimed → 3. TaskUpdate claim → 4. Do work → 5. SendMessage lead → 6. Check for more

If Agent Teams not enabled: sequential execution with standard subagent behavior.

### Teammate Operation Pattern

```
1. TaskList → find unclaimed tasks
2. TaskUpdate(taskId, status="in_progress") → claim
3. Do work → TaskUpdate(taskId, status="completed")
4. SendMessage(recipient="orchestrator", content="Done: [summary]")
5. Check for more tasks or await shutdown
```

## State Management

```
workflow:handoff  → Saves to .claude/logs/workflows/[workflow-id]/
workflow:resume <id> → Loads saved state, continues from last phase
workflow:status   → Shows current phase, completed phases, pending tasks
```

## Phase Context (ON-DEMAND ONLY)

Phase-specific context is loaded from the kit's built-in rules:

- Phase 1: `.claude/rules/gate-rules.md` (Gate 1 approval)
- Phase 2-3: `.claude/rules/tdd-rules.md` (RED/GREEN enforcement)
- Phase 4: `.claude/rules/gate-rules.md` (Gate 2 approval) + `.claude/rules/security-rules.md`
- Phase 5: `.claude/rules/development-rules.md` (pre-commit checks)
