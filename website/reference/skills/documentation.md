---
title: "meow:documentation"
description: "Documentation toolkit — living docs, API sync, and changelog generation for Phase 6"
---

# meow:documentation

Documentation toolkit — living docs, API sync, and changelog generation for Phase 6

## What This Skill Does

This is a **reference toolkit** — a collection of guides used by agents during specific workflow phases. Each guide is in the `references/` subdirectory and loaded on-demand.

## When to Use This

Phase 6 (Reflect) documentation updates. Agents load these references automatically — you rarely invoke this skill directly.

::: info Skill Details
**Phase:** 6  
**Used by:** documenter agent
:::

## Gotchas

- **Docs drifting from code silently**: No automated check that docs match current implementation → Run docs:sync after every feature ship, not just when remembered
- **Auto-generated docs overwriting manual edits**: Regenerating API docs clobbers hand-written examples → Use separate files for generated vs curated content

## Related

- [Workflow Phases](/guide/workflow-phases) — Where this toolkit is used
- [Agents Overview](/reference/agents/) — Which agents use these references
