---
title: "meow:testing"
description: "Testing toolkit — red-green-refactor (when --tdd enabled), validation scripts, and visual QA. TDD is opt-in."
---

# meow:testing

Testing toolkit — red-green-refactor (when `--tdd` / `MEOWKIT_TDD=1` enabled), validation scripts, and visual QA.

## What This Skill Does

This is a **reference toolkit** — a collection of guides used by agents during specific workflow phases. Each guide is in the `references/` subdirectory and loaded on-demand.

## When to Use This

Phase 2-3 TDD enforcement. Agents load these references automatically — you rarely invoke this skill directly.

::: info Skill Details
**Phase:** 2  
**Used by:** tester agent
:::

## Gotchas

- **Mocks hiding integration failures**: All mocked tests pass but real service calls fail → Use integration tests for critical paths; mock only external third-party services
- **Test coverage metric gamed by trivial assertions**: 100% coverage with `expect(true).toBe(true)` → Measure mutation testing score alongside coverage; flag tests with zero assertions

## Related

- [Workflow Phases](/guide/workflow-phases) — Where this toolkit is used
- [Agents Overview](/reference/agents/) — Which agents use these references
