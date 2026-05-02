---
title: "mk:bootstrap"
description: "End-to-end project orchestrator — research → design → plan → scaffold → implement → docs. For new projects from scratch."
---

# mk:bootstrap

End-to-end project orchestrator for new projects from scratch. Research → design → plan → scaffold → implement → docs. Explicit invocation only — never auto-activates.

## When to use

Creating a new project from scratch. NOT for autonomous builds of specified products (use `mk:harness`); NOT for single-task feature work (use `mk:cook`).

## CLI boundary

`npx mewkit init` = project infrastructure (`.claude/`). `mk:bootstrap` = application code + full pipeline. Zero overlap. Never touch `.claude/`.

## Process

1. Research — understand requirements, tech choices
2. Design — architecture, data model, component tree
3. Plan — `mk:plan-creator` for structured plan
4. Scaffold — generate project structure and boilerplate
5. Implement — `mk:cook` or `mk:harness` for implementation
6. Docs — `mk:docs-init` for documentation suite
