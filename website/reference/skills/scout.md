---
title: "mk:scout"
description: "Parallel codebase exploration that divides the project into segments and searches them simultaneously using Explore subagents."
---

# mk:scout

Parallel codebase exploration that divides the project into segments and searches them simultaneously using Explore subagents.

## What This Skill Does

`mk:scout` solves the "where is everything?" problem that comes up at the start of any complex task. It divides your codebase into logical segments (source, tests, config, types), spawns 2-6 parallel Explore agents to search them simultaneously, and returns a consolidated report with an architecture fingerprint, file map, complexity estimates, and routing suggestions for which agent should handle which area.

## Core Capabilities

- **3-tier search scope** — Tier 1 (always: src, lib, config), Tier 2 (on request: tests, docs, migrations), Tier 3 (never: node_modules, .git, dist)
- **SCALE formula** — Calculates optimal number of parallel agents: `min(directory_count, 6)`
- **Architecture fingerprint** — Detects framework, language, patterns, monorepo status, test framework in 5 lines
- **Entry point identification** — Surfaces main.ts, index.ts, app.py — the highest-signal files
- **Complexity estimation** — File count + line count per area → low/medium/high
- **Handoff routing** — Recommends which MeowKit agent should work on each area

## When to Use This

::: tip Use mk:scout when...
- Starting work on a feature that spans multiple directories
- You need to understand project structure before planning
- Debugging and need to find related files
- You're new to a codebase and need orientation
:::

## Usage

```bash
# Search for auth-related files
/mk:scout authentication

# Find database migration files
/mk:scout database migrations

# Understand project structure
/mk:scout project structure
```

## Example Prompts

| Prompt | What scout finds |
|--------|-----------------|
| `/mk:scout authentication` | Auth middleware, guards, login pages, auth tests, token utils |
| `/mk:scout database` | Models, migrations, seeds, schema files, DB config |
| `/mk:scout payment` | Payment controllers, Stripe integration, billing tests |

## Quick Workflow

```
Query → SCALE Calculation → Tier Filtering
  → Parallel Explore Agents (2-6)
  → Deduplicate + Merge Results
  → Architecture Fingerprint + Entry Points
  → Complexity Estimates + Routing Suggestions
  → Scout Report (~2000 tokens max)
```

::: info Skill Details
**Phase:** 0  
**Used by:** orchestrator agent
:::

## Gotchas

- **Subagents returning partial results**: Context window exceeded, agent returns truncated output → Set explicit file count limits per subagent; merge results with dedup
- **Missing hidden files in directory scan**: Default glob patterns skip dotfiles → Include dotfiles explicitly when scanning config directories

## Related

- [`mk:investigate`](/reference/skills/investigate) — Uses scout's file map for debugging
- [`mk:docs-finder`](/reference/skills/docs-finder) — Finds external docs (not codebase files)
