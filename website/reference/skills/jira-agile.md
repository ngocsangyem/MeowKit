---
title: "mk:jira-agile"
description: "JIRA agile: epics, sprints, backlog, ranking, story points, subtasks, velocity."
---

# mk:jira-agile

## What This Skill Does

Forks the `jira-agile` agent to drive the agile layer: epics, sprints, backlog, ranking, story points, subtasks, velocity reports. Sprint operations require a numeric `--board-id`, not the project key.

## When to Use

- **Triggers:** "list sprints on board X", "add PROJ-123 to sprint", "set 5 story points", "rank PROJ-123 before PROJ-456", "velocity for board", "create epic"
- **NOT for:** issue CRUD ([`mk:jira-issue`](/reference/skills/jira-issue)) · time tracking ([`mk:jira-time`](/reference/skills/jira-time)).

## Board ID ≠ Project Key (critical)

Sprint ops need a numeric `board_id`, not `PROJ`. Resolve human board names first:

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh agile board list --name "Team Alpha"
```

Mixing project keys and board IDs is the #1 source of "board not found" errors.

## Verified Wrapper Invocations

| Operation | Tier | Invocation |
|---|---|---|
| List boards | 1 | `... agile board list [--name "..."]` |
| List sprints | 1 | `... agile sprint list --board-id <ID>` |
| Sprint create | 2 | `... agile sprint create --board-id <ID> --name "..." --start <ISO> --end <ISO>` |
| Add to sprint | 3 | `... agile sprint add --sprint-id <ID> --issues PROJ-1,PROJ-2` |
| Backlog | 1 | `... agile backlog --board-id <ID>` |
| Set story points | 3 | `... agile estimate PROJ-123 --points 5` |
| Velocity | 1 | `... agile velocity --board-id <ID>` |
| Epic create | 2 | `... agile epic create --project PROJ --name "Epic Name"` |
| Epic add issue | 3 | `... agile epic add EPIC-1 --issues PROJ-1,PROJ-2` |
| Subtask create | 2 | `... agile subtask create PARENT-1 --summary "..."` |

## Domain References

- `references/sprint-operations.md` — board / sprint / velocity wrapper patterns
- `references/agile-field-reference.md` — agile-specific field IDs (Sprint, Epic Link, Story Points)

## Peer Leaves

`mk:jira-fields` (canonical instance-discovery: `references/agile-field-ids.md`) · `mk:jira-time` (capacity = velocity ÷ team time) · `mk:jira-relationships` (epic-children outside epic-link)

## Agent

[`jira-agile`](/reference/agents/jira-agile) — A + C, NOT B.
