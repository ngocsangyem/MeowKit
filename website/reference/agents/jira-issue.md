---
title: jira-issue
description: Domain agent for JIRA issue CRUD via the jira-as wrapper. Forked from mk:jira-issue.
---

# jira-issue

Domain agent invoked by [`mk:jira-issue`](/reference/skills/jira-issue) via `context: fork`. Executes single-issue create / get / update / delete via the `jira-as` CLI wrapper.

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

| Op | Tier | Verified invocation |
|---|---|---|
| Get | 1 | `... issue get PROJ-123` |
| Create | 2 | `... issue create --project PROJ --type Bug --summary "..."` |
| Create from template | 2 | `... issue create --project PROJ --template bug --summary "..."` |
| Update | 3 | `... issue update PROJ-123 --summary "..."` |
| Delete | 4 | `... issue delete PROJ-123` |

Wrapper prefix: `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh`. Run `--help` per verb for the authoritative flag list.

## Templates

`jira-as` ships with `bug`, `task`, `story` templates. The agent points users at `meowkit/.claude/skills/jira-issue/references/issue-templates.md` for canonical Markdown ticket bodies.

## Memory (MeowKit convention)

Append observations using prefix protocol per `meowkit/CLAUDE.md`:

- `##pattern: jira-issue: <project pattern>` → `.claude/memory/quick-notes.md`
- `##decision: jira-issue: <choice + rationale>` → `.claude/memory/decisions.md`
- Custom field IDs / project schemas → `.claude/memory/architecture-decisions.md`

NEVER write ticket bodies, comment content, or token values to memory.

## Failure handling (jira-as exit codes)

| Exit | Action |
|---|---|
| 1 | Validation — re-read `--help`, fix the flag, retry |
| 2 | Auth — escalate; user updates `.claude/.env` |
| 3 | Permission — report; user lacks Jira permission |
| 4 | Not found — confirm key exists |
| 5 | Rate limit — backoff + retry once |

## Skill

[`mk:jira-issue`](/reference/skills/jira-issue)
