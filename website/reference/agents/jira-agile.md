---
title: jira-agile
description: "Domain agent for agile: epics, sprints, backlog, ranking, story points, subtasks, velocity."
---

# jira-agile

Domain agent invoked by [`mk:jira-agile`](/reference/skills/jira-agile) via `context: fork`.

## Key facts

| | |
|---|---|
| **Type** | Domain |
| **Phase** | on-demand |
| **Tools** | Bash, Read, Grep, Glob |
| **Model** | inherit |
| **Memory** | project |
| **Color** | pink |
| **Skill Rule of Two** | A + C, NOT B (2/3 compliant) |

## Board ID ≠ Project Key (critical)

Sprint operations require numeric `--board-id`, not the project key. Agent resolves human board names via `agile board list --name "..."` first.

## Operations

| Op | Tier | Wrapper invocation |
|---|---|---|
| List boards | 1 | `... agile board list [--name "..."]` |
| List sprints | 1 | `... agile sprint list --board-id <ID>` |
| Sprint create | 2 | `... agile sprint create --board-id <ID> --name "..." --start <ISO> --end <ISO>` |
| Add to sprint | 3 | `... agile sprint add --sprint-id <ID> --issues PROJ-1,PROJ-2` |
| Backlog | 1 | `... agile backlog --board-id <ID>` |
| Set story points | 3 | `... agile estimate PROJ-123 --points 5` |
| Velocity | 1 | `... agile velocity --board-id <ID>` |
| Epic create | 2 | `... agile epic create --project PROJ --name "Epic Name"` |
| Subtask create | 2 | `... agile subtask create PARENT-1 --summary "..."` |

## Skill

[`mk:jira-agile`](/reference/skills/jira-agile)
