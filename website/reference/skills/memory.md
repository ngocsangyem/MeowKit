---
title: "meow:memory"
description: "Memory system toolkit — session capture, pattern extraction, and cost tracking"
---

# meow:memory

Memory system toolkit — session capture, pattern extraction, cost tracking, and consolidation.

## What This Skill Does

A **reference toolkit** — a collection of guides used by agents during specific workflow phases. Each guide is in the `references/` subdirectory and loaded on-demand.

| Reference | When Loaded | Content |
|-----------|-------------|---------|
| `session-capture.md` | Phase 6 | 3-category learning extraction (patterns/decisions/failures) |
| `pattern-extraction.md` | Phase 6 | Frequency-based promotion to CLAUDE.md |
| `cost-tracking.md` | Phase 0, 6 | Token usage tracking and budget reports |
| `consolidation.md` | Manual | Prune stale entries, merge duplicates, archive cost data |

## When to Use This

Phase 0 (Orient) and Phase 6 (Reflect) persistence. Agents load these references automatically — you rarely invoke this skill directly. Consolidation is the exception: invoke manually when memory reaches scale (20+ sessions, 50+ patterns, 500+ cost entries).

::: info Skill Details
**Phase:** 0, 6
**Used by:** analyst, journal-writer agents
:::

## Schema (v1.2.0)

`patterns.json` entries now support optional fields: `category` (pattern/decision/failure), `severity` (critical/standard), `applicable_when` (condition sentence). Existing entries without these fields remain valid — `severity` defaults to `standard`.

See [Memory System guide](/guide/memory-system) for the full schema reference.

## Gotchas

- **Stale patterns applied to changed codebase**: Run consolidation when patterns exceed 50 entries; flag patterns with `lastSeen` > 6 months
- **cost-log.json growing unbounded**: Run consolidation to archive entries older than 90 days
- **NEEDS_CAPTURE markers in lessons.md**: Stop hook writes markers at session end; Phase 0 processes them retroactively (max 3, 2-min budget)

## Related

- [Memory System](/guide/memory-system) — Comprehensive guide with architecture, FAQ, and migration
- [Workflow Phases](/guide/workflow-phases) — Where this toolkit is used
- [analyst agent](/reference/agents/analyst) — Primary agent using these references
