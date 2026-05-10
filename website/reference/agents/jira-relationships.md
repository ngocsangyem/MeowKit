---
title: jira-relationships
description: "Domain agent for issue relationships: link, unlink, blockers, dependencies, clone, bulk-link."
---

# jira-relationships

Domain agent invoked by [`mk:jira-relationships`](/reference/skills/jira-relationships) via `context: fork`.

## Key facts

| | |
|---|---|
| **Type** | Domain |
| **Phase** | on-demand |
| **Tools** | Bash, Read, Grep, Glob |
| **Model** | inherit |
| **Memory** | project |
| **Color** | purple |
| **Skill Rule of Two** | A + C, NOT B (2/3 compliant) |

## Operations

| Op | Tier | Wrapper invocation |
|---|---|---|
| Link | 2 | `... relationships link PROJ-123 --type blocks --to PROJ-456` |
| Unlink | 3 | `... relationships unlink PROJ-123 --link-id <ID>` |
| Get blockers | 1 | `... relationships get-blockers PROJ-123` |
| Get dependencies | 1 | `... relationships get-dependencies PROJ-123` |
| Clone | 2 | `... relationships clone PROJ-123 --summary "..."` |
| Bulk-link by JQL | 3 | `... relationships bulk-link --jql "<JQL>" --type blocks --to PROJ-456 --dry-run` |

`bulk-link` lives in the `relationships` group (verified `relationships_cmds.py:1661`). Link direction is not symmetric — agent confirms when ambiguous.

## Skill

[`mk:jira-relationships`](/reference/skills/jira-relationships)
