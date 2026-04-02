---
title: "meow:bootstrap"
description: "End-to-end project orchestrator: research → design → scaffold → plan → implement → docs."
---

# meow:bootstrap

End-to-end project orchestrator: research → design → scaffold → plan → implement → docs.

## What This Skill Does

`meow:bootstrap` orchestrates the full journey from idea to running code. It doesn't implement anything itself — it wires together MeowKit's existing skills in sequence: parallel research, tech stack selection via brainstorming, design with UI/UX designer, file scaffolding, planning via plan-creator, implementation via cook, and documentation via docs-init.

Complements `npx mewkit init` — CLI = MeowKit infrastructure (.claude/), bootstrap = application code + full pipeline.

## Core Capabilities

- **4 workflow modes** — Full (all gates), Auto (design gate only), Fast (no gates), Parallel (concurrent implementation)
- **Research phase** — parallel researcher subagents validate idea + recommend tech stack
- **Design phase** — UI/UX designer for frontend projects with design guidelines + wireframes
- **Stack auto-detection** — 40+ stacks via detect-stack.sh (or ask user for unknown)
- **Progressive scaffolding** — structure → config → source → tests (never all at once)
- **Full pipeline** — invokes plan-creator, cook, and docs-init (not just handoff text)
- **CLI boundary** — never touches .claude/ (CLI handles that)

## When to Use This

::: tip Use meow:bootstrap when...
- Starting a new project from scratch
- You want the full pipeline: research → design → scaffold → plan → implement → docs
- You need MeowKit's workflow applied from day one
:::

::: warning Don't use meow:bootstrap when...
- Project already has source code → use `meow:plan-creator` for new features
- You only need MeowKit setup → use `npx mewkit init`
:::

## Usage

```bash
# Default (auto mode — design gate only)
/meow:bootstrap build a task management app with Vue 3 + NestJS

# Full mode — gates at every step, maximum control
/meow:bootstrap build an e-commerce platform --full

# Fast mode — no gates, max speed, good for prototypes
/meow:bootstrap quick prototype for a CLI tool --fast

# Parallel mode — concurrent implementation for large projects
/meow:bootstrap build a SaaS dashboard --parallel
```

## Modes

| Mode | Gates | Research | Design | Best for |
|------|-------|----------|--------|----------|
| **Auto** (default) | Design only | Parallel researchers | UI/UX if frontend | Most projects |
| **Full** | Every step | Parallel researchers | UI/UX if frontend | Critical projects |
| **Fast** | None | 6 parallel batch | Skip | Prototypes, hackathons |
| **Parallel** | Design only | Parallel researchers | UI/UX if frontend | Large multi-module projects |

## Pipeline

```
bootstrap → git init → research → tech stack → design
  → plan-creator → scaffold files → cook → docs-init → done
```

::: info Skill Details
**Phase:** Pre-workflow (full pipeline for new projects)
**Invocation:** Explicit only — never auto-activates
:::

## Gotchas

- **Skipping research on "simple" projects**: hidden complexity emerges during implementation → always research unless --fast
- **Duplicating CLI init**: never generates .claude/ — CLI handles that
- **Context overflow**: progressive generation per scaffolding-principles.md

## Related

- [`meow:brainstorming`](/reference/skills/brainstorming) — Used during tech stack selection
- [`meow:plan-creator`](/reference/skills/plan-creator) — Invoked for planning phase
- [`meow:cook`](/reference/skills/cook) — Invoked for implementation phase
- [`meow:docs-init`](/reference/skills/docs-init) — Invoked for documentation phase
