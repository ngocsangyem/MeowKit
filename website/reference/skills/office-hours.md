---
title: "meow:office-hours"
description: "YC-style brainstorming with two modes — Startup (six forcing questions) and Builder (design thinking for side projects)."
---
# meow:office-hours
YC-style brainstorming with two modes — Startup (six forcing questions) and Builder (design thinking for side projects).
## What This Skill Does
Modeled after Y Combinator office hours, this skill forces you to think critically about whether something is worth building *before* any code is written. Startup mode asks six forcing questions that expose demand reality. Builder mode runs design thinking for side projects and hackathons.
## Core Capabilities
- **Startup mode** — Six forcing questions: demand reality, status quo, desperate specificity, narrowest wedge, observation, future-fit
- **Builder mode** — Design thinking brainstorming for side projects, hackathons, learning
- **Design doc output** — Saves structured findings as a design document
- **Pre-plan skill** — Use before `/meow:plan-ceo-review` or `/meow:plan-eng-review`
## Usage
```bash
/meow:office-hours           # auto-detect mode
"I have an idea for..."      # triggers startup mode
"brainstorm this"            # triggers builder mode
```
::: info Skill Details
**Phase:** 1  
**Used by:** planner, brainstormer agents  
**Plan-First Gate:** Pre-planning skill — always skips gate.
:::

## Gotchas

- **Solutioning before understanding the problem**: Jumping to "how to build" before validating "should we build" → Force problem statement completion before any technical discussion
- **Anchoring on first idea**: First brainstormed solution gets disproportionate attention → Generate at least 3 alternatives before evaluating any

## Related
- [`meow:plan-ceo-review`](/reference/skills/plan-ceo-review) — CEO-level plan review (use after office-hours)
- [`meow:plan-eng-review`](/reference/skills/plan-eng-review) — Engineering plan review
