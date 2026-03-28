---
title: "meow:planning"
description: "Planning toolkit — plan templates, premise challenge, and ADR generation"
---

# meow:planning

Planning toolkit — plan templates, premise challenge, and ADR generation

## What This Skill Does

This is a **reference toolkit** — a collection of guides used by agents during specific workflow phases. Each guide is in the `references/` subdirectory and loaded on-demand.

## When to Use This

Phase 1 (Plan) structured planning. Agents load these references automatically — you rarely invoke this skill directly.

::: info Skill Details
**Phase:** 1  
**Used by:** planner, architect agents
:::

## Gotchas

- **Over-planning trivial tasks**: Creating full ADR + multi-phase plan for a config change → Use plan-quick.md for < 5 files; skip planning entirely for < 2 files
- **Premise challenge becoming scope creep**: Questioning assumptions leads to expanding scope → Time-box premise challenge to 5 minutes; document but don't act on expansion ideas

## Related

- [Workflow Phases](/guide/workflow-phases) — Where this toolkit is used
- [Agents Overview](/reference/agents/) — Which agents use these references
