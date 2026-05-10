---
title: jira-search
description: Domain agent for JIRA search + saved-filter management. JQL injection-safe via shared sanitizer.
---

# jira-search

Domain agent invoked by [`mk:jira-search`](/reference/skills/jira-search) via `context: fork`.

## Key facts

| | |
|---|---|
| **Type** | Domain |
| **Phase** | on-demand |
| **Tools** | Bash, Read, Grep, Glob |
| **Model** | inherit |
| **Memory** | project |
| **Color** | green |
| **Skill Rule of Two** | A + C, NOT B (2/3 compliant) |

## Operations

| Op | Tier | Wrapper invocation |
|---|---|---|
| Query | 1 | `... search query "<JQL>" --max-results 20` |
| Validate | 1 | `... search validate "<JQL>"` |
| Build from NL | 1 | `... search build --description "..."` |
| Bulk update by JQL | 3 | `... search bulk-update "<JQL>" --field labels=urgent --dry-run` |
| Export | 1 | `... search export "<JQL>" --output-file /tmp/out.csv` |
| Filter create | 2 | `... filter create --name "..." --jql "<JQL>"` |
| Filter delete | 4 | `... filter delete <FILTER_ID>` |

## JQL Sanitization (mandatory)

Pass any user-derived term through `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jql-sanitize.sh '<term>'` before embedding in JQL.

## Skill

[`mk:jira-search`](/reference/skills/jira-search)
