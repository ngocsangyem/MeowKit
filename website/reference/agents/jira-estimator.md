---
title: jira-estimator
description: Intelligence agent — read-only heuristic story-point estimation. Auto-consumes prior evaluator output.
---

# jira-estimator

Intelligence agent invoked by [`mk:jira-estimator`](/reference/skills/jira-estimator) via `context: fork`. Produces a **heuristic story-point estimation** (Fibonacci suggestion) for a single Jira ticket. Read-only — never mutates Jira.

## Key facts

| | |
|---|---|
| **Type** | Intelligence |
| **Phase** | on-demand |
| **Tools** | Bash, Read, Grep, Glob, Write |
| **Model** | inherit |
| **Memory** | project |
| **Color** | orange |
| **Skill Rule of Two** | A + C (FS write only — NEVER Jira state), NOT B (2/3 compliant) |

`Write` is allowlisted only for persisting to `tasks/reports/jira-estimate-*.md`.

## Custom-Field Discovery (mandatory)

Before reading or writing story points, the agent verifies the per-instance ID:

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh fields list --search "Story Points" \
  | jq '.[] | select(.name == "Story Points") | .id'
```

`customfield_10016` is the upstream-default + the value documented across `mk:jira-fields/references/agile-field-ids.md`, `mk:jira-agile/references/agile-field-reference.md`, and `mk:jira-admin/references/voodoo-constants.md`. If discovered ID differs, use it.

## Evaluator-First Recommendation

If no prior evaluation output is provided in the task brief, the agent prompts the user to run `mk:jira-evaluator <KEY>` first for more informed estimation. If `tasks/reports/jira-evaluate-*-{KEY}.md` exists, the agent reads it automatically.

## Escalation Triggers

Auto-flag for human estimation when ANY of:

- Suggested range spans >1 Fibonacci step
- Zero historical precedent in project
- Ticket references unfamiliar technology
- Description too vague (<30 words, no AC)

## Report persistence

Writes to `tasks/reports/jira-estimate-{YYMMDD}-{HHMM}-{ISSUE-KEY}.md`. Consumed by `mk:planning-engine` (capacity), `mk:cook` plan-creation step.

## Skill

[`mk:jira-estimator`](/reference/skills/jira-estimator)
