---
title: jira-ops
description: Domain agent for jira-as cache + project-context discovery. Diagnostic surface only.
---

# jira-ops

Domain agent invoked by [`mk:jira-ops`](/reference/skills/jira-ops) via `context: fork`.

## Key facts

| | |
|---|---|
| **Type** | Domain |
| **Phase** | on-demand |
| **Tools** | Bash, Read, Grep, Glob |
| **Model** | inherit |
| **Memory** | project |
| **Color** | yellow |
| **Skill Rule of Two** | A + C, NOT B (2/3 compliant) |

## Operations

| Op | Tier | Wrapper invocation |
|---|---|---|
| Cache status | 1 | `... ops cache-status` |
| Cache clear | 1 | `... ops cache-clear` (clears jira-as local cache) |
| Discover project | 1 | `... ops discover-project --project PROJ` |

`cache-warm` is power-user only — invoke directly via wrapper.

## Skill

[`mk:jira-ops`](/reference/skills/jira-ops)
