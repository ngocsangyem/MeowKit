---
title: "mk:scout"
description: "Fast parallel codebase exploration — spawns multiple Explore subagents for consolidated file mapping."
---

# mk:scout

Fast, parallel codebase exploration using Explore subagents. Divides the project into segments, searches simultaneously, returns a consolidated report with architecture fingerprint, complexity estimates, and routing suggestions.

## Usage

```bash
/mk:scout authentication          # Find all auth-related files
/mk:scout database migrations     # Find DB migration files
/mk:scout [any search target]     # Parallel search across codebase
```

## When to use

- Starting a feature spanning multiple directories
- Before planning (Phase 1) on complex tasks — understand what exists first
- Debugging sessions requiring file relationship understanding
- User asks about project structure or where functionality lives

## Workflow integration

Operates in Phase 0 (Orient) and Phase 1 (Plan). Orchestrator invokes before planner on COMPLEX tasks. Planner may invoke when technical approach needs codebase understanding. Developer may invoke when touching unfamiliar areas.

## Scout process

1. Analyze — parse prompt, identify search targets (keywords, file types)
2. Determine scale — calculate using formula in `references/scouting-strategy.md`
3. Apply search scope — include Tier 1 always, Tier 2 if task-relevant, exclude Tier 3
4. Divide directories — assign each Explore agent distinct scope (no overlap)
5. Consolidate results — single report with file map, architecture fingerprint, routing suggestions
