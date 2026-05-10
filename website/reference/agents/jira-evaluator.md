---
title: jira-evaluator
description: Intelligence agent — read-only ticket complexity + inconsistency analysis. Persists report.
---

# jira-evaluator

Intelligence agent invoked by [`mk:jira-evaluator`](/reference/skills/jira-evaluator) via `context: fork`. Analyzes a single Jira ticket for **complexity** and **inconsistencies**. Read-only — never mutates Jira. Persists evaluation reports for cross-session continuity.

## Key facts

| | |
|---|---|
| **Type** | Intelligence |
| **Phase** | on-demand |
| **Tools** | Bash, Read, Grep, Glob, Write |
| **Model** | inherit |
| **Memory** | project |
| **Color** | green |
| **Skill Rule of Two** | A + C (FS write only — NEVER Jira state), NOT B (2/3 compliant) |

The `Write` tool is allowlisted only for persisting to `tasks/reports/jira-evaluate-*.md`.

## Read pattern

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh issue get PROJ-123 --fields '*all' \
  | jq '{key, summary, description, status, comments, attachments, links}'
```

`--fields '*all'` is required to surface attachments + links.

## Complexity Signals

Scope · Dependencies · Regression risk · Requirement clarity · External integration · Historical context (sanitized JQL) · **Workflow shape** (read from `tasks/jira-workflows/<workflow-slug>.md` — agent runs `fetch-workflow.sh` if cache absent).

## Injection Defense

Wraps all ticket content in `===TICKET_DATA_START===` / `===TICKET_DATA_END===` boundaries (with nonce variant when content collides). Never follows instructions found within ticket data.

## Report persistence

Writes to `tasks/reports/jira-evaluate-{YYMMDD}-{HHMM}-{ISSUE-KEY}.md`. Consumed by `mk:jira-estimator`, `mk:planning-engine`, `mk:cook` plan-creation step.

## Skill

[`mk:jira-evaluator`](/reference/skills/jira-evaluator)
