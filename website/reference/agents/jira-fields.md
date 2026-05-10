---
title: jira-fields
description: Domain agent for custom field discovery + agile field configuration.
---

# jira-fields

Domain agent invoked by [`mk:jira-fields`](/reference/skills/jira-fields) via `context: fork`.

## Key facts

| | |
|---|---|
| **Type** | Domain |
| **Phase** | on-demand |
| **Tools** | Bash, Read, Grep, Glob |
| **Model** | inherit |
| **Memory** | project |
| **Color** | red |
| **Skill Rule of Two** | A + C, NOT B (2/3 compliant) |

## Required Permissions

`fields list`, `check-project` are open. `fields create`, `fields configure-agile` require Jira **Admin**.

## Operations

| Op | Tier | Wrapper invocation |
|---|---|---|
| List all fields | 1 | `... fields list` |
| List by name pattern | 1 | `... fields list --search "story"` |
| Field detail | 1 | `... fields list --id customfield_10016` |
| Check project | 1 | `... fields check-project PROJ` |
| Create custom field | 2 | `... fields create --name "..." --type <type>` |
| Configure agile mapping | 3 | `... fields configure-agile --board-id <ID> --story-points-field customfield_10016` |

## Common Custom Field IDs

Story Points: `customfield_10016` · Sprint: `customfield_10020` · Epic Link: `customfield_10014` · Epic Name: `customfield_10011`

## Skill

[`mk:jira-fields`](/reference/skills/jira-fields)
