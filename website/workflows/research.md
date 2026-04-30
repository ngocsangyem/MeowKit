---
title: Researching Libraries
description: Evaluate libraries, frameworks, and technical approaches with structured findings.
persona: B
---

# Researching Libraries

> Evaluate options with source-graded findings and confidence levels.

**Best for:** Choosing dependencies, evaluating frameworks, gathering docs  
**Time estimate:** 15-30 minutes  
**Skills used:** [mk:docs-finder](/reference/skills/docs-finder), [mk:scout](/reference/skills/scout)  
**Agents involved:** researcher (Haiku model), brainstormer

## Overview

The **researcher** agent fans out queries to multiple sources (official docs, GitHub, community posts, Stack Overflow) and evaluates quality. The **brainstormer** agent compares approaches with pros/cons/tradeoffs. Both feed into the **planner** for informed decision-making.

## Step-by-step guide

### Step 1: Ask the research question

```
"Compare Prisma vs Drizzle for our PostgreSQL project"
```

### Step 2: Researcher gathers findings

The **researcher** (running on Haiku for cost efficiency) evaluates sources:

| Source type | Trust level |
|-------------|------------|
| Official documentation | Highest |
| Well-maintained GitHub repos | High |
| Recent blog posts (<12 months) | Medium |
| Stack Overflow answers | Low (must cross-reference) |

```
Researcher findings:
  Prisma: Established (2019+), 37K GitHub stars, extensive docs
    Strengths: Schema-first, great DX, auto-migrations
    Weaknesses: Runtime overhead, limited raw SQL, heavy bundle

  Drizzle: Emerging (2023+), 28K GitHub stars, growing fast
    Strengths: Zero overhead, SQL-like syntax, lightweight
    Weaknesses: Younger ecosystem, fewer guides

  Confidence: HIGH (both well-documented)
```

### Step 3: Brainstormer evaluates tradeoffs

```
Approach 1: Prisma — choose if team values DX and auto-migrations
Approach 2: Drizzle — choose if team values performance and SQL familiarity
Second-order: Prisma locks you into their schema format. Drizzle stays close to SQL.
```

### Step 4: Find specific documentation

```
/mk:docs-finder drizzle PostgreSQL transactions
```

The [mk:docs-finder](/reference/skills/docs-finder) skill fetches current docs via Context7 or Context Hub, avoiding stale training data.

## Next workflow

→ [Maintaining Old Projects](/workflows/maintenance) — work in unfamiliar codebases
