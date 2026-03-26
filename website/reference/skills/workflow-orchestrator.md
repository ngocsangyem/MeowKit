---
title: "meow:workflow-orchestrator"
description: "Execute 5-phase TDD workflow for complex features with token budgets, approval gates, and fast-track mode."
---
# meow:workflow-orchestrator
Execute 5-phase TDD workflow for complex features with token budgets, approval gates, and fast-track mode.
## What This Skill Does
Orchestrates the full 5-phase development workflow: Understand+Design → Test RED → Build GREEN → Refactor+Review → Finalize. Includes token budgets per phase (target ≤30K total), two approval gates, and a fast-track mode that skips Phase 1 when specs are pre-approved.
## Core Capabilities
- **5-phase pipeline** — Design → Test → Build → Refactor → Finalize
- **Two approval gates** — Phase 1 (Design) and Phase 3 (Build)
- **Token budgets** — Per-phase limits to prevent context explosion
- **Fast-track mode** — Skip Phase 1 for pre-approved specs
- **Auto-continue** — Phases 2, 4, 5 auto-continue unless blockers found
## Usage
```bash
/meow:cook [feature]              # standard 5-phase workflow
"fasttrack: [specs]"              # skip Phase 1
"workflow:start [task]"           # explicit invocation
```
## Related
- [`meow:cook`](/reference/skills/cook) — The user-facing entry point that triggers this
- [`meow:session-continuation`](/reference/skills/session-continuation) — Save/resume workflow state
