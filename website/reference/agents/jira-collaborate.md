---
title: jira-collaborate
description: Domain agent for comments, attachments, watchers, notifications. Internal-vs-public comment safety enforced.
---

# jira-collaborate

Domain agent invoked by [`mk:jira-collaborate`](/reference/skills/jira-collaborate) via `context: fork`.

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

## Operations

| Op | Tier | Wrapper invocation |
|---|---|---|
| Comment add | 2 | `... collaborate comment add PROJ-123 --body "text"` |
| Comment list | 1 | `... collaborate comment list PROJ-123` |
| Comment delete | 4 | `... collaborate comment delete PROJ-123 --comment-id <ID>` |
| Attachment upload | 2 | `... collaborate attachment upload PROJ-123 --file /path/to/file` |
| Attachment download | 1 | `... collaborate attachment download PROJ-123 --attachment-id <ID> --output /tmp/...` |
| Watcher add | 2 | `... collaborate watcher add PROJ-123 --user <username>` |
| Notify | 2 | `... collaborate notify PROJ-123 --message "..."` |

## Internal-vs-Public Safety

The agent confirms intent before posting any comment that could be customer-facing — defaults to `internal` if uncertain.

## Skill

[`mk:jira-collaborate`](/reference/skills/jira-collaborate)
