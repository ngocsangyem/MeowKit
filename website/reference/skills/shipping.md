---
title: "meow:shipping"
description: "Simplified shipping toolkit — ship pipeline, canary deployment, and rollback protocol"
---

# meow:shipping

Simplified shipping toolkit — ship pipeline, canary deployment, and rollback protocol

## What This Skill Does

This is a **reference toolkit** — a collection of guides used by agents during specific workflow phases. Each guide is in the `references/` subdirectory and loaded on-demand.

## When to Use This

Phase 5 (Ship) reference. Agents load these references automatically — you rarely invoke this skill directly.

::: info Skill Details
**Phase:** 5  
**Used by:** shipper agent
:::

## Gotchas

- **Canary deploy without monitoring**: Deploying canary but not watching metrics → Always set up health checks BEFORE canary rollout; define rollback trigger
- **Rollback plan referencing deleted infrastructure**: Rollback docs point to old deployment scripts → Validate rollback plan against current infra before every ship

## Related

- [Workflow Phases](/guide/workflow-phases) — Where this toolkit is used
- [Agents Overview](/reference/agents/) — Which agents use these references
