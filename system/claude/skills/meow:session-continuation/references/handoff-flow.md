<!-- Extracted from SKILL.md for progressive disclosure (checklist #11, #14) -->

# Handoff Flow Detail

## Step 1: Detect Need

Triggers: Token count ≥150K (75%), user request ("handoff", "save", "pause"), long workflow (Phases 1-2 complete).

Auto-prompt: "Token usage is at 75%. Would you like to save workflow state for continuation?"

## Step 2: Save State

**Location:** `.claude/logs/workflows/[workflow-id]/workflow-state.json`

```json
{
  "workflow_id": "AUTH-123",
  "version": "1.0.0",
  "created_at": "2025-11-29T14:30:22Z",
  "status": "paused",
  "current_phase": 3,
  "phase_name": "Build GREEN",
  "task": { "description": "...", "ticket_id": "..." },
  "agents": { "primary": "architect", "secondary": ["security", "tester"] },
  "phases_completed": { "1": { "status": "approved", "deliverables": [...] }, "2": { ... } },
  "context": { "tech_stack": "...", "key_decisions": [...], "blockers": [], "notes": "..." },
  "token_usage": { "at_handoff": 152340, "estimated_remaining": 47660 }
}
```

## Step 3: Generate Summary

Output:
```markdown
WORKFLOW HANDOFF COMPLETE
**Workflow ID:** AUTH-123
**Progress:** Phase 1: Approved, Phase 2: Approved, Phase 3: In Progress
**State Saved:** .claude/logs/workflows/AUTH-123/workflow-state.json
**Key Decisions:** [list]
**TO RESUME:** Type: `workflow:resume AUTH-123`
```
