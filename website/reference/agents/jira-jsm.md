---
title: jira-jsm
description: Domain agent for JIRA Service Management: 8 sub-domains, ~45 verbs. Requires JSM license + agent role.
---

# jira-jsm

Domain agent invoked by [`mk:jira-jsm`](/reference/skills/jira-jsm) via `context: fork`.

## Key facts

| | |
|---|---|
| **Type** | Domain |
| **Phase** | on-demand |
| **Tools** | Bash, Read, Grep, Glob |
| **Model** | inherit |
| **Memory** | project |
| **Color** | cyan |
| **Skill Rule of Two** | A + C, NOT B (2/3 compliant) |

## Required Permissions

JSM-licensed tenant + agent or admin role. Insufficient permission → exit code 3.

## Internal-vs-Public Comments

Agent confirms intent on JSM tickets — public comments visible to customer; internal comments team-only.

## Sub-Domains (8)

`service-desk` · `request-type` · `request` · `customer` · `organization` · `queue` · `sla` · `approval`

## Operations (selection)

| Op | Tier | Wrapper invocation |
|---|---|---|
| List service desks | 1 | `... jsm service-desk list` |
| Create request | 2 | `... jsm request create --service-desk-id <ID> --request-type-id <ID> --summary "..."` |
| SLA status | 1 | `... jsm sla get <KEY>` |
| Approve | 3 | `... jsm approval approve <APPROVAL_ID>` |

## Skill

[`mk:jira-jsm`](/reference/skills/jira-jsm)
