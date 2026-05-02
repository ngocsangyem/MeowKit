---
title: "mk:project-context"
description: "Generate or update docs/project-context.md — the agent constitution loaded by all agents."
---

# mk:project-context

Creates `docs/project-context.md` — the single source of truth for project conventions, tech stack, and anti-patterns. Loaded by all agents on activation to ensure consistent behavior.

## Purpose

Without a single authoritative file, agents infer conventions independently and make conflicting decisions. Project context eliminates this drift.

## Usage

```bash
/mk:project-context generate    # Full generation from codebase analysis
/mk:project-context update      # Incremental update after feature work
/mk:project-context init        # Initial setup for new projects
```

For full documentation suite generation, use `mk:docs-init` instead. This skill generates only the agent constitution.
