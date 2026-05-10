---
title: jira-lifecycle
description: Domain agent for JIRA workflow lifecycle: transitions, assignment, resolution, version + component management. Cache-first transition discovery.
---

# jira-lifecycle

Domain agent invoked by [`mk:jira-lifecycle`](/reference/skills/jira-lifecycle) via `context: fork`.

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

## Workflow Discovery (MANDATORY before suggesting transitions)

The agent reads `tasks/jira-workflows/` (instance-discovered cache) and runs `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/fetch-workflow.sh <KEY>` if absent. Pattern files at `meowkit/.claude/skills/jira-lifecycle/references/patterns/*.md` are CONCEPT REFERENCES, NOT AUTHORITATIVE.

## Operations

| Op | Tier | Wrapper invocation |
|---|---|---|
| Transition by name | 3 | `... lifecycle transition PROJ-123 --to "In Progress"` |
| Transition by ID | 3 | `... lifecycle transition PROJ-123 --id 21` |
| Transition w/ resolution | 3 | `... lifecycle transition PROJ-123 --to Done --resolution Fixed` |
| Assign | 3 | `... lifecycle assign PROJ-123 --user john.doe` |
| Resolve | 3 | `... lifecycle resolve PROJ-123 --resolution Fixed` |
| Reopen | 3 | `... lifecycle reopen PROJ-123` |
| Version create | 3 | `... lifecycle version create PROJ --name "v1.0.0"` |

## Skill

[`mk:jira-lifecycle`](/reference/skills/jira-lifecycle)
