---
title: "mk:session-continuation"
description: "mk:session-continuation"
---

## What This Skill Does
Persists and restores mid-session workflow progress across context resets. Captures plan state, active agents, current phase, key decisions, and file state at handoff. On resume, reads the saved state and continues from the exact interruption point -- no context lost.

## When to Use
- Token count approaching 150K (75% of context limit) -- auto-prompts
- User says "handoff", "save state", "pause", or "resume workflow"
- Session ending with an incomplete workflow
- Resuming an incomplete workflow from a previous session

## Core Capabilities
1. **Handoff:** Saves complete workflow state (phase, agents, decisions, deliverables, token usage) to `.claude/logs/workflows/[workflow-id]/workflow-state.json` and generates a summary with exact resume instructions
2. **Resume:** Loads state from file, validates it (exists, valid JSON, compatible version, status is "paused"), restores context (project, agents, phase rules, key decisions), and continues from the saved phase
3. **Auto-Save:** Silent background saves on phase completion, every 5 minutes, at token milestones (100K, 150K, 175K), and before external writes -- no user notification for routine saves
4. **List:** `workflow:list` shows all saved workflows with their status
5. **Plan State Variables:** Tracks MEOWKIT_ACTIVE_PLAN, MEOWKIT_SUGGESTED_PLAN, MEOWKIT_COMPLEXITY, and MEOWKIT_ACTIVE_AGENTS across sessions
6. **TOON format:** Token-efficient state representation (~160 tokens vs ~600 tokens JSON, 73% reduction)

## Arguments
| Command | Syntax | Action |
|---------|--------|--------|
| Handoff | `workflow:handoff` | Save state + generate resume instructions |
| Resume | `workflow:resume `ID` | Load state + continue from last phase |
| List | `workflow:list` | Show all saved workflows |

## Workflow
1. Detect trigger -- token limit, user command, or session ending
2. If handoff: load `references/handoff-flow.md`, save full state to JSON, generate summary with workflow ID, progress, state file path, key decisions, and resume command
3. If resume: load `references/resume-and-state.md`, validate state file, restore context, show resume summary, continue from saved phase
4. If list: display all saved workflows from `.claude/logs/workflows/`

## Usage
```
workflow:handoff           -> Save state + get resume instructions
workflow:resume AUTH-123   -> Load state + continue from last phase
workflow:list              -> Show all saved workflows
```

## Example Prompt
"I need to stop here. Save my workflow state so I can resume later."

The skill will: save state to `.claude/logs/workflows/AUTH-123/workflow-state.json`, output a handoff summary showing Phase 1-3 progress, key decisions made, and the exact `workflow:resume AUTH-123` command to use when you return.

## Common Use Cases
- Long-running multi-phase workflows hitting context limits
- Pausing work at end of day/week
- Switching between multiple parallel workflows
- Sharing handoff context with another developer
- Recovering from unexpected session termination

## Pro Tips
- Auto-save runs silently every 5 minutes -- state is usually available even if you forget to handoff
- Completed workflows auto-cleanup after 30 days; cancelled after 7 days; paused workflows persist indefinitely
- The TOON format saves ~73% tokens vs JSON for state representation
- Error handling covers missing state files (shows available workflows), corrupted JSON (attempts backup recovery), and version mismatches (attempts migration with user confirmation)
- Validate all file paths in handoff state before resuming -- codebase changes between sessions can make saved file references stale