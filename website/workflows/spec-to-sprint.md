---
title: Tickets to Sprint Planning
description: Research-driven workflow from ticket evaluation through codebase review to sprint planning.
persona: B
---

# Tickets to Sprint Planning

> Evaluate, estimate, review against codebase, produce planning reports — then decide what to commit.

**Best for:** Tech leads, engineering managers, sprint planners
**Time estimate:** 5-15 min (depending on ticket count)
**Skills used:** [mk:intake](/reference/skills/intake), [mk:jira-issue](/reference/skills/jira-issue), [mk:jira-evaluator](/reference/skills/jira-evaluator), [mk:jira-estimator](/reference/skills/jira-estimator), [mk:jira-relationships](/reference/skills/jira-relationships), [mk:planning-engine](/reference/skills/planning-engine), [mk:scout](/reference/skills/scout) (optional), [mk:web-to-markdown](/reference/skills/web-to-markdown) (optional)

::: warning Not for standalone bugs or hotfixes
This workflow is for **planning new work into a sprint**. If you have an existing ticket to fix or implement, use the [Ticket to Code](/workflows/ticket-to-code) workflow instead.
:::

## Prerequisites

<!--@include: ./_jira-setup.md-->

## The Principle

Every step produces a **report**. Human reads and decides before proceeding. No automation. No auto-creation. No auto-assignment.

## Step-by-step

### Step 1: Have tickets in your backlog

This workflow assumes the work is already represented as Jira tickets. If you're starting from a spec document instead, see the **"Importing a spec"** sidebar below.

::: tip Importing a spec (alternative entry point)
If your spec lives outside Jira (a Confluence page, Notion doc, or any URL):

1. Convert the URL to markdown: `/mk:web-to-markdown <spec-url>`
2. Run `/mk:intake` and paste the markdown content (or save to a file and reference it)
3. mk:intake produces a Spec Research Report with `[MISSING]` / `[VAGUE]` / `[AMBIGUOUS]` tags and suggested user stories
4. You then create the tickets manually (Step 2) — never auto-creation

This is a manual, human-gated import. There is no first-party Confluence reader anymore.
:::

### Step 2: Create tickets (your decision)

For stories you approve from the report:

```bash
/mk:jira-issue create --project AUTH --type Story --summary "Implement OAuth2 login" \
  --description "OAuth2 flow for Google and GitHub providers"
```

You decide which stories to create, what priority to set, and how to word them.

### Step 3: Evaluate and estimate

```bash
/mk:jira-evaluator AUTH-201
/mk:jira-estimator AUTH-201
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
| Have tickets ready | Step 3 (evaluate) |
| Have a spec/URL | "Importing a spec" sidebar above, then Step 2 |
| One ticket only | Step 4 (tech review) |
| Ready for sprint planning | Step 5 |

No step requires the previous step's output as a hard dependency.

## Human Gates

| Gate | Who decides | AI provides |
|---|---|---|
| Which stories to create | **You** | Suggestions in spec / intake report |
| Story point estimates | **Team** (planning poker) | Complexity signals |
| Which tickets enter sprint | **Team** (self-selection) | Grouping suggestions |
| Sprint goal | **PO + team** (negotiation) | Candidate draft |
| Dependency resolution | **Team** | Cycle detection |

## Related

- [mk:jira-issue](/reference/skills/jira-issue) — ticket CRUD
- [mk:jira-evaluator](/reference/skills/jira-evaluator) — complexity assessment
- [mk:jira-estimator](/reference/skills/jira-estimator) — story-point suggestion
- [mk:planning-engine](/reference/skills/planning-engine) — tech review + sprint planning
- [PRD Intake Automation](/workflows/prd-intake) — raw ticket triage (different workflow)
- [Ticket Evaluation & Estimation](/workflows/ticket-evaluation) — single-ticket evaluation
