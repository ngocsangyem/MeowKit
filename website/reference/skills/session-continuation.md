---
title: "mk:session-continuation"
description: "Persists and restores mid-session workflow progress across context resets. Save state, resume with workflow ID."
---

# mk:session-continuation

Manages workflow state across sessions with handoff and resume. Runs on Haiku tier.

## When to use

- Token count approaching 150K (75% of limit)
- User says "handoff", "save", "pause", "resume" + workflow ID
- Session ending with incomplete workflow
- Incomplete workflow from previous session

## How it works

Captures plan state variables, active agent, current phase, and file state at handoff. On resume, reads state file and continues from exact interruption point.
