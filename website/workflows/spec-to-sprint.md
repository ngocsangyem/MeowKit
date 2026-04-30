---
title: Spec to Sprint Planning
description: Research-driven workflow from Confluence spec analysis through codebase review to sprint planning.
persona: B
---

# Spec to Sprint Planning

> Analyze specs, review against codebase, produce planning reports — then decide what to build.

**Best for:** Tech leads, engineering managers, sprint planners
**Time estimate:** 5-15 min per spec (depending on size)
**Skills used:** [mk:confluence](/reference/skills/confluence), [mk:jira](/reference/skills/jira), [mk:planning-engine](/reference/skills/planning-engine), [mk:scout](/reference/skills/scout) (optional)

::: warning Not for standalone bugs or hotfixes
This workflow is for **planning new work from specs**. If you have an existing ticket to fix or implement, use the [Ticket to Code](/workflows/ticket-to-code) workflow instead.
:::

## The Principle

Every step produces a **report**. Human reads and decides before proceeding. No automation. No auto-creation. No auto-assignment.

## Step-by-step

### Step 1: Analyze the spec

```bash
/mk:confluence analyze PAGE-ID
```

Produces a **Spec Research Report**: requirements extracted, gaps flagged, stories suggested.

Read the report. Check the `[MISSING]`, `[VAGUE]`, and `[AMBIGUOUS]` tags. Ask the PO to fill gaps before proceeding.

### Step 2: Create tickets (your decision)

For stories you approve from the report:

```bash
/mk:jira create --project AUTH --type Story --summary "Implement OAuth2 login" \
  --description "OAuth2 flow for Google and GitHub providers"
```

You decide which stories to create, what priority to set, and how to word them.

### Step 3: Evaluate and estimate

```bash
/mk:jira evaluate AUTH-201
/mk:jira estimate AUTH-201
```

Produces complexity assessment and story point suggestion. The **team** makes the final estimate in planning poker — the AI provides signals, not decisions.

### Step 4: Tech review (optional, with codebase context)

Run scout first for codebase context:

```bash
/mk:scout
/mk:planning-engine review AUTH-201 --scout
```

Produces a **Tech Review Report**: affected files, feasibility rating, dependencies, risks, complexity signals.

### Step 5: Sprint planning

```bash
/mk:planning-engine plan --tickets AUTH-201,AUTH-202,AUTH-203 --capacity 40
```

Produces a **Planning Report**: sprint goal candidate, dependency map, grouping suggestions, capacity analysis.

The **team** negotiates the sprint goal, self-selects work, and commits.

## You Can Start Anywhere

| Starting point | Skip to |
|---|---|
| Have a Confluence spec | Step 1 |
| Already have tickets | Step 3 (evaluate) or Step 4 (tech review) |
| One ticket only | Step 4 (tech review) |
| Ready for sprint planning | Step 5 |

No step requires the previous step's output as a hard dependency.

## Human Gates

| Gate | Who decides | AI provides |
|---|---|---|
| Which stories to create | **You** | Suggestions in spec report |
| Story point estimates | **Team** (planning poker) | Complexity signals |
| Which tickets enter sprint | **Team** (self-selection) | Grouping suggestions |
| Sprint goal | **PO + team** (negotiation) | Candidate draft |
| Dependency resolution | **Team** | Cycle detection |

## Related

- [mk:confluence](/reference/skills/confluence) — spec analysis
- [mk:jira](/reference/skills/jira) — ticket operations
- [mk:planning-engine](/reference/skills/planning-engine) — tech review + sprint planning
- [PRD Intake Automation](/workflows/prd-intake) — raw ticket triage (different workflow)
- [Ticket Evaluation & Estimation](/workflows/ticket-evaluation) — single-ticket evaluation
