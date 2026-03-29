<!-- Extracted from SKILL.md for progressive disclosure (checklist #11, #14) -->

# Resume Flow & State Management

## Resume Steps

1. **Parse command:** `workflow:resume AUTH-123`
2. **Load state:** `.claude/logs/workflows/[id]/workflow-state.json` — validate exists, valid JSON, compatible version, status is "paused"
3. **Restore context:** Load project context, activate saved agents, load phase rules, restore key decisions + deliverables
4. **Show resume summary:** Workflow ID, task, restored state, completed phases, key decisions, "CONTINUING FROM: Phase [N]"
5. **Continue:** Resume from saved phase, show agent banner, execute remaining steps

## Commands

| Command | Syntax | Action |
|---------|--------|--------|
| Handoff | `workflow:handoff` | Save state + generate resume instructions |
| Resume | `workflow:resume <id>` | Load state + continue from last phase |
| List | `workflow:list` | Show all saved workflows with status |

## Auto-Save Behavior

Events: Phase completion, every 5 minutes, token milestones (100K, 150K, 175K), before external writes. Silent — no user notification for routine saves.

## State File Structure

```
.claude/logs/workflows/
├── AUTH-123/
│   ├── workflow-state.json
│   ├── requirements.md
│   └── test-plan.md
└── README.md
```

Cleanup: completed 30 days, cancelled 7 days, paused indefinitely.

## Error Handling

| Error | Response |
|-------|----------|
| Not found | Show available workflows, suggest `workflow:start` |
| Corrupted JSON | Attempt backup recovery, ask user to confirm |
| Version mismatch | Attempt migration, ask user to confirm |

## TOON State Format (Token-Efficient)

```toon
workflow:
  id: AUTH-1234
  phase: 5
  status: in_progress
phases[5]{num,name,status}:
  1,Understand + Design,completed
  2,Test RED,completed
  3,Build GREEN,in_progress
  4,Refactor + Review,pending
  5,Finalize,pending
agents[2]: architect,tester
```

Token savings: TOON ~160 tokens vs JSON ~600 tokens (73% reduction).
