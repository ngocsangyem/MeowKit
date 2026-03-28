---
title: "meow:memory"
description: "Memory system toolkit — session capture, pattern extraction, and cost tracking"
---

# meow:memory

Memory system toolkit — session capture, pattern extraction, and cost tracking

## What This Skill Does

This is a **reference toolkit** — a collection of guides used by agents during specific workflow phases. Each guide is in the `references/` subdirectory and loaded on-demand.

## When to Use This

Phase 0 (Orient) and Phase 6 (Reflect) persistence. Agents load these references automatically — you rarely invoke this skill directly.

::: info Skill Details
**Phase:** 0, 6  
**Used by:** analyst, journal-writer agents
:::

## Gotchas

- **Stale patterns applied to changed codebase**: Memory suggests patterns from old architecture → Include timestamp and context hash in pattern entries; flag old patterns on read
- **cost-log.json growing unbounded**: Every session appends without pruning → Implement monthly rollup: archive entries older than 90 days

## Related

- [Workflow Phases](/guide/workflow-phases) — Where this toolkit is used
- [Agents Overview](/reference/agents/) — Which agents use these references
