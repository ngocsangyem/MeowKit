---
title: jira-dev
description: "Domain agent for developer artifact generation: branch names, PR descriptions, commit parsing, smart-commit linking."
---

# jira-dev

Domain agent invoked by [`mk:jira-dev`](/reference/skills/jira-dev) via `context: fork`.

## Key facts

| | |
|---|---|
| **Type** | Domain |
| **Phase** | on-demand |
| **Tools** | Bash, Read, Grep, Glob |
| **Model** | inherit |
| **Memory** | project |
| **Color** | blue |
| **Skill Rule of Two** | A + C, NOT B (2/3 compliant) |

## Operations

| Op | Tier | Wrapper invocation |
|---|---|---|
| Branch name | 1 | `... dev branch-name PROJ-123` |
| PR description | 1 | `... dev pr-description PROJ-123` |
| Parse commits | 1 | `... dev parse-commits --range main..HEAD` |
| Link commit | 2 | `... dev link-commit PROJ-123 --sha <SHA>` |
| Link PR | 2 | `... dev link-pr PROJ-123 --pr-url https://github.com/.../pull/N` |

## Branch-Name Convention

Default: `<type>/<KEY>-<kebab-summary>` (e.g. `feat/PROJ-123-add-login-rate-limiting`).

## Skill

[`mk:jira-dev`](/reference/skills/jira-dev)
