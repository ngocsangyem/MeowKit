---
title: jira-admin
description: Domain agent for project / user / group / scheme / automation administration. 11 sub-domains, ~65 verbs. Requires admin role. Highest blast radius.
---

# jira-admin

Domain agent invoked by [`mk:jira-admin`](/reference/skills/jira-admin) via `context: fork`.

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

Every verb requires Jira **Admin**. Some require **Site Admin**.

## DESTRUCTIVE Operations (2-step token confirmation)

`admin project delete`, `admin user delete`, `admin group delete` — agent requires user to type the literal target identifier as confirmation. Always offers archive (project) / deactivate (user) as the first choice.

## Sub-Domains (11)

`project` · `config` · `category` · `user` · `group` · `automation` · `automation-template` · `permission-scheme` · `permission` · `notification-scheme` · `notification`

## Operations (selection)

| Op | Tier | Wrapper invocation |
|---|---|---|
| List projects | 1 | `... admin project list` |
| Create project | 2 | `... admin project create --key NEW --name "..." --type software-scrum` |
| Delete project | 4 | `... admin project delete <KEY> --dry-run` (then 2-step confirm) |
| List users | 1 | `... admin user list` |
| Deactivate user | 3 | `... admin user deactivate <ACCOUNT_ID>` |
| Add to group | 3 | `... admin group add-member <GROUP> --account-id <ID>` |

## Skill

[`mk:jira-admin`](/reference/skills/jira-admin)
