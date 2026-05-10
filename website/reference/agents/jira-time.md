---
title: jira-time
description: "Domain agent for time tracking: log, list/edit/delete worklogs, set estimates, generate reports."
---

# jira-time

Domain agent invoked by [`mk:jira-time`](/reference/skills/jira-time) via `context: fork`.

## Key facts

| | |
|---|---|
| **Type** | Domain |
| **Phase** | on-demand |
| **Tools** | Bash, Read, Grep, Glob |
| **Model** | inherit |
| **Memory** | project |
| **Color** | orange |
| **Skill Rule of Two** | A + C, NOT B (2/3 compliant) |

## Operations

| Op | Tier | Wrapper invocation |
|---|---|---|
| Log work | 2 | `... time log PROJ-123 --time 2h --comment "..."` |
| List worklogs | 1 | `... time worklogs PROJ-123` |
| Update worklog | 3 | `... time update-worklog PROJ-123 --worklog-id <ID> --time 3h` |
| Delete worklog | 4 | `... time delete-worklog PROJ-123 --worklog-id <ID>` (data lost) |
| Set estimate | 3 | `... time estimate PROJ-123 --original 1d --remaining 4h` |
| Time report by JQL | 1 | `... time report --jql "<JQL>" --from 2026-04-01 --to 2026-04-30` |
| Bulk log | 2 | `... time bulk-log --jql "<JQL>" --time 30m --dry-run` |

`time log` takes the issue key positional + `--time` flag (NOT positional duration).

## Skill

[`mk:jira-time`](/reference/skills/jira-time)
