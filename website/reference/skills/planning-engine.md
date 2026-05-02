---
title: "mk:planning-engine"
description: "Analyzes ticket complexity and maps dependencies against existing codebase before sprint planning — capacity estimation, dependency graphing, tech review."
---

# mk:planning-engine

## What This Skill Does

Pre-sprint analysis engine. Takes a set of tickets and produces three reports: technical review (complexity, risks, unknowns per ticket), capacity estimate (story points with bin-packing), and dependency graph (execution order, cycles, critical path). Delegates deep analysis to subagents (`tech-analyzer`, `planning-reporter`).

## When to Use

- Sprint planning — need to estimate tickets before the sprint starts
- Backlog grooming — need technical assessment of incoming tickets
- Dependency analysis — need to understand execution order across tickets
- **NOT for:** creating Jira tickets (use `mk:jira`), assigning work, modifying sprints, breaking dependency cycles

## Core Capabilities

- **Technical review:** 7-dimension assessment per ticket (complexity, risk, unknowns, dependencies, test surface, security surface, data impact) with 3 confidence levels
- **Capacity estimation:** story point estimation with bin-packing algorithm. Flags `[INCOMPLETE]` when >30% of tickets are unestimated
- **Dependency graphing:** cycle detection (reports cycles but does NOT auto-break), orphan detection, critical path computation
- **Subagents:** `tech-analyzer` (per-ticket deep analysis) and `planning-reporter` (report generation)
- **Graceful degradation:** each optional input (scout report, dependency graph, evaluate/estimate output) has a specific flag when missing

## Arguments

| Flag | Effect |
|------|--------|
| (no flag) | Full analysis — all three reports |
| `--tech-only` | Technical review only |
| `--capacity-only` | Capacity estimate only |
| `--deps-only` | Dependency graph only |

## Workflow

1. **Scout** — gather codebase context (optional, flagged if missing)
2. **Tech Review** — spawn `tech-analyzer` subagent per ticket with injection defense (ticket content wrapped in boundary markers)
3. **Capacity** — run `capacity-bin.py` with estimated points, flag incomplete estimates
4. **Dependencies** — run `dep-graph.py`, detect cycles and orphans, compute critical path
5. **Report** — spawn `planning-reporter` subagent to synthesize findings
6. **Output** — produce three structured reports with templates

## Usage

```bash
/mk:planning-engine PROJ-123 PROJ-124 PROJ-125
/mk:planning-engine --capacity-only sprint-42-tickets.txt
```

## Example Prompt

```
Analyze these tickets for next sprint: PROJ-101 (add payment gateway), PROJ-102 (fix login timeout), PROJ-103 (migrate user profiles to new schema). I need tech review, capacity, and dependency order.
```

## Common Use Cases

- Sprint planning with Jira ticket keys
- Backlog technical triage
- Capacity planning for team allocation
- Dependency-aware execution ordering

## Pro Tips

- **Always verify PTO/ceremonies/focus factor.** Capacity estimation assumes 100% availability unless told otherwise.
- **Cycles are surfaced, not broken.** If two tickets depend on each other, the engine reports the cycle. Your team decides how to break it.
- **More than 30% unestimated tickets triggers `[INCOMPLETE]`.** Run estimates first (`mk:jira estimate`) before full planning.

> **Canonical source:** `.claude/skills/planning-engine/SKILL.md`
