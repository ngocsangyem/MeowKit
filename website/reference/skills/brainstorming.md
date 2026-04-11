---
title: "meow:brainstorming"
description: "Structured technical ideation with scoring, technique selection, and plan-creator handoff."
---

# meow:brainstorming

Structured technical ideation with scoring, technique selection, and plan-creator handoff.

## What This Skill Does

`meow:brainstorming` explores technical solutions for validated problems. Given a problem description, it selects an ideation technique, generates 5-8 structured ideas, optionally scores them, and can hand the top idea off to `meow:plan-creator` for implementation planning.

Key differentiator from `meow:office-hours`: office-hours asks "should we build this?", brainstorming asks "how should we build this?"

## Core Capabilities

- **4 ideation techniques** — multi-alternative (default), first-principles, reverse, constraint-mapping
- **Depth control** — quick (ideas only) or deep (scored + action-plan ready)
- **Structured scoring** — feasibility, impact, simplicity, novelty with weighted totals
- **Plan-creator handoff** — top idea flows directly into plan creation with pre-research context
- **Context budget** — max 8 ideas per run to prevent context flooding
- **Anti-bias rules** — scores all ideas before comparing; flags conservative-only results

## When to Use This

::: tip Use meow:brainstorming when...
- You have a validated problem and need technical solutions
- You want to compare 2-3 architectural approaches with trade-offs
- You need structured idea generation (not freeform chat)
- You want scored recommendations before committing to a plan
:::

::: warning Don't use meow:brainstorming when...
- Problem isn't validated yet → use [`meow:office-hours`](/reference/skills/office-hours)
- You already have a plan → use [`meow:plan-ceo-review`](/reference/skills/plan-eng-review)
- You need to debug/investigate → use [`meow:investigate`](/reference/skills/investigate)
:::

## Usage

```bash
# Quick brainstorm (default — 5-8 ideas, no scoring)
/meow:brainstorming how should we handle real-time notifications

# Deep brainstorm (scored ideas + top 3 recommendations)
/meow:brainstorming how to handle file uploads --depth deep

# Force a specific technique
/meow:brainstorming prevent auth failures --technique reverse
```

## Techniques

| Technique | When to use |
|-----------|------------|
| multi-alternative | Default — "how to build X", multiple approaches exist |
| first-principles | Novel problem, no existing patterns |
| reverse | "How could this fail?" — debugging/prevention mindset |
| constraint-mapping | Many constraints, narrow solution space |

## Quick Workflow

```
Problem → Restate + Confirm → Select Technique
  → Generate Ideas (max 8) → Score (if deep)
  → Top 3 Recommendations → Plan Handoff (optional)
```

::: info Skill Details
**Phase:** 1 (pre-planning)
**Used by:** planner, brainstormer agents
:::

## Gotchas

- **Premature solutioning**: jumping to "how" before confirming "what" → force problem restatement first
- **Anchoring on first idea**: generate ALL ideas before evaluating any
- **Context flooding**: max 8 ideas per run — quality over quantity

## Related

- [`meow:office-hours`](/reference/skills/office-hours) — Product validation BEFORE brainstorming
- [`meow:plan-creator`](/reference/skills/plan-creator) — Creates plan FROM brainstorming output
- [`meow:plan-ceo-review`](/reference/skills/plan-eng-review) — Reviews existing plans
