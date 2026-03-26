---
title: Sprint Retrospective
description: Run a team-aware engineering retrospective with commit analysis and trend tracking.
persona: B
---

# Sprint Retrospective

> Analyze commits, work patterns, and code quality with persistent trend tracking.

**Best for:** End of sprint, weekly review  
**Time estimate:** 10-15 minutes  
**Skills used:** [meow:retro](/reference/skills/retro)  
**Agents involved:** analyst (cost data), documenter (saves report)

## Overview

The [meow:retro](/reference/skills/retro) skill analyzes your git history to produce a structured retrospective. It's team-aware (breaks down per-person contributions) and tracks trends across runs to show improvement or regression.

## Step-by-step guide

### Step 1: Run the retrospective

```
/meow:retro
```

### Step 2: Review the analysis

The skill analyzes:
- **Commits** by type (feat, fix, refactor, docs) and author
- **Work patterns** — velocity, review turnaround, deploy frequency
- **Code quality** — test coverage trends, security findings over time
- **Per-person** — contributions, strengths, growth areas (with praise)
- **Cost** — token usage from `memory/cost-log.json` via the **analyst** agent

### Step 3: Track trends

Each retrospective is saved, so the next one compares:
- Are we shipping more or fewer features?
- Is review turnaround improving?
- Are security findings decreasing?
- Is cost per feature going up or down?

### How the analyst agent contributes

The **analyst** provides cost and pattern data from `memory/`:
- Token usage trends (are we using cheaper models when appropriate?)
- Pattern frequency (recurring issues that should become rules)
- Lessons learned that inform the retrospective's recommendations

## Next workflow

→ [Architecture Decisions](/workflows/architecture) — document architectural choices
