---
title: "meow:development"
description: "Development reference toolkit — code patterns, TDD enforcement, and skill loading for Phase 3"
---

# meow:development

Development reference toolkit — code patterns, TDD enforcement, and skill loading for Phase 3

## What This Skill Does

This is a **reference toolkit** — a collection of guides used by agents during specific workflow phases. Each guide is in the `references/` subdirectory and loaded on-demand.

## When to Use This

Phase 3 (Build GREEN) implementation guidance. Agents load these references automatically — you rarely invoke this skill directly.

::: info Skill Details
**Phase:** 3  
**Used by:** developer agent
:::

## Gotchas

- **TDD enforcement blocking exploratory prototyping**: Strict red-green cycle slows rapid iteration → Use fast mode for prototypes, switch to default mode before shipping
- **200-line file rule on generated code**: Auto-generated files (migrations, schemas) exceed limit by design → Exempt generated files explicitly in plan constraints

## Related

- [Workflow Phases](/guide/workflow-phases) — Where this toolkit is used
- [Agents Overview](/reference/agents/) — Which agents use these references
