---
title: "mk:planning-engine"
description: "Codebase-aware tech breakdown and sprint planning analysis with dependency mapping and capacity modeling."
---

# mk:planning-engine

Codebase-aware tech breakdown and sprint planning analysis. Produces reports for human decision-making — NOT automated ticket assignment or sprint modification.

## What This Skill Does

mk:planning-engine analyzes Jira tickets against codebase context (via mk:scout) and produces two types of reports:

- **Tech Review Report** — single-ticket feasibility analysis: affected files, dependencies, risks, complexity signals
- **Planning Report** — multi-ticket sprint planning: dependency map, grouping suggestions, sequencing, capacity analysis

The skill is research-only. It never creates tickets, assigns work, sets story points, moves tickets into sprints, or breaks dependencies. All decisions are human-made.

## Core Capabilities

- **Tech review** — Analyze a ticket against the codebase for implementation feasibility
- **Dependency mapping** — Build dependency graph from Jira issue links, detect circular dependencies
- **Sprint grouping** — Group tickets by epic/component/dependency chain, suggest sequencing
- **Capacity analysis** — Bin-pack tickets into sprint capacity with overflow detection
- **Sprint goal** — Suggest a candidate sprint goal based on ticket themes (team negotiates)

## When to Use

```bash
# Single-ticket tech review
/mk:planning-engine review PROJ-123
/mk:planning-engine review PROJ-123 --scout    # After running /mk:scout first

# Multi-ticket sprint planning
/mk:planning-engine plan --tickets PROJ-101,PROJ-102,PROJ-103
/mk:planning-engine plan --tickets PROJ-101,PROJ-102 --capacity 40
```

::: info Human decides everything
The planning report suggests groupings, sequencing, and a sprint goal candidate. The **team** decides what to pull, how to estimate, and what the sprint goal is. AI provides observations — never assignments.
:::

## Prerequisites

Requires the [mcp-atlassian](https://github.com/sooperset/mcp-atlassian) MCP server for Jira access:

```bash
claude mcp add -e JIRA_URL=https://your-company.atlassian.net \
  -e JIRA_USERNAME=your-email@company.com \
  -e JIRA_API_TOKEN=your-api-token \
  atlassian -- uvx mcp-atlassian
```

Optional: run `/mk:scout` before tech review for codebase context.

## Upstream Context

Works best when:
- Tickets have been evaluated (`/mk:jira evaluate`) — complexity signals improve reviews
- Tickets have been estimated (`/mk:jira estimate`) — points enable capacity analysis
- A spec report exists (`/mk:confluence analyze`) — provides business context

None required. Degrades gracefully without each.

## Report Output

Reports saved to active plan's `research/` or `tasks/reports/`.

### Tech Review Report
- Feasibility rating: Straightforward / Complex / Needs Spike
- Affected files (from scout or `[NO_CODEBASE_CONTEXT]`)
- Dependencies and risks
- Complexity signals (observations, NOT estimates)

### Planning Report
- Sprint goal candidate (draft for team negotiation)
- Dependency map with critical path and circular dependency detection
- Grouping suggestions by theme/epic
- Capacity analysis with `[INCOMPLETE]` warning when >30% tickets unestimated
- Overflow list for tickets that don't fit

## Scrum Alignment

This skill follows Agile Scrum principles:

| Principle | How the skill respects it |
|---|---|
| Team self-selects work | Reports suggest groupings — never assigns |
| Team estimates | Reports provide complexity SIGNALS — never point values |
| PO owns priority | No priority suggestions in reports |
| Sprint goal is negotiated | Reports suggest a CANDIDATE — team decides |
| Pull-based, not push | All state changes require human command |

## Gotchas

- `--scout` requires running `/mk:scout` separately first (skills can't invoke other skills)
- Capacity analysis needs `--capacity N` from user — the skill can't calculate team availability
- Circular dependencies are detected and presented — the skill does NOT auto-break them
- Maximum 20 tickets per planning run
- AI complexity signals are observations, NOT estimates or anchors

## Related

- [mk:jira](/reference/skills/jira) — ticket operations + evaluation/estimation
- [mk:confluence](/reference/skills/confluence) — upstream spec analysis
- [mk:scout](/reference/skills/scout) — codebase context for tech reviews
- [mk:plan-creator](/reference/skills/plan-creator) — file-level implementation plans (different from sprint planning)
- [Spec to Sprint Planning](/workflows/spec-to-sprint) — end-to-end workflow guide
