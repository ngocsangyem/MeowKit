---
title: jira-bulk
description: Domain agent for bulk operations on 10+ issues. Dry-run mandatory; reads workflow cache.
---

# jira-bulk

Domain agent invoked by [`mk:jira-bulk`](/reference/skills/jira-bulk) via `context: fork`.

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

## MANDATORY Dry-Run Workflow

```
Step 1 (always):  invocation + --dry-run
Step 2 (always):  show user the would_* JSON keys + impacted-count
Step 3 (only after explicit "yes"):  invocation without --dry-run
```

Skipping Step 1 is a hard violation — agent refuses.

## Workflow Cache (REQUIRED)

For `bulk transition`, the agent validates target status against `tasks/jira-workflows/<workflow-slug>.md`. Runs `fetch-workflow.sh <KEY>` if absent.

## Operations

| Op | Tier | Wrapper invocation |
|---|---|---|
| Bulk transition | 4 | `... bulk transition --jql "<JQL>" --to "Done" --dry-run` |
| Bulk assign | 4 | `... bulk assign --jql "<JQL>" --assignee john.doe --dry-run` |
| Bulk set priority | 4 | `... bulk set-priority --jql "<JQL>" --priority High --dry-run` |
| Bulk clone | 4 | `... bulk clone --jql "<JQL>" --target-project DEST --dry-run` |
| Bulk delete | 4 | `... bulk delete --jql "<JQL>" --dry-run` (irreversible) |

## Skill

[`mk:jira-bulk`](/reference/skills/jira-bulk)
