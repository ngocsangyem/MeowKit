---
title: "mk:confluence-collaborate"
description: "Manage Confluence collaboration surface — comments, attachments, labels, watchers — via the confluence-as wrapper. Forks the confluence-collaborate agent."
---

# mk:confluence-collaborate

## What This Skill Does

Forks the `confluence-collaborate` agent to manage the per-page collaboration layer: comments, attachments, labels, watchers. The agent prefers footer comments over inline; it confirms before posting an inline comment because inline anchors require unique selection text.

## When to Use

- **Triggers:** "add comment to page 12345", "list comments on page 12345", "upload screenshot.png to page 12345", "label page 12345 as 'urgent'", "watch page 12345"
- **NOT for:** page CRUD ([`mk:confluence-page`](/reference/skills/confluence-page)), bulk ops across ≥10 pages ([`mk:confluence-bulk`](/reference/skills/confluence-bulk)).

## Verified CLI Idioms

| Operation | Tier | Wrapper invocation |
|---|---|---|
| Comment add (footer) | 2 | `... comment add --page-id 12345 --body "<text>"` |
| Comment add (inline) | 2 | `... comment add --page-id 12345 --inline --selection "<unique anchor>" --body "<text>"` |
| Comment list | 1 | `... comment list --page-id 12345` |
| Attachment upload | 2 | `... attachment upload --page-id 12345 --file /tmp/repro.mp4` |
| Attachment download | 1 | `... attachment download --attachment-id <aid> --output /tmp/<name>` |
| Label add | 2 | `... label add --page-id 12345 --label rfc` |
| Label remove | 3 | `... label remove --page-id 12345 --label draft` |
| Watcher add / remove | 2/3 | `... watch add --page-id 12345` · `... watch remove --page-id 12345` |
| Watcher list | 1 | `... watch list --page-id 12345` |

Upload paths must be under `$CLAUDE_PROJECT_DIR` or an explicitly allowlisted `/tmp/conf-*` prefix. The agent independently validates path traversal before delegating to the wrapper.

## Domain References

- `references/comment-formats.md` — inline vs footer, markdown vs storage format
- `references/attachment-conventions.md` — file size limits, allowed types, download paths

## Peer Leaves

[`mk:confluence-page`](/reference/skills/confluence-page) (page CRUD; create-with-attachment) · [`mk:confluence-bulk`](/reference/skills/confluence-bulk) (bulk-label across 10+ pages) · [`mk:confluence-spec-analyst`](/reference/skills/confluence-spec-analyst) (downloads attachments for image analysis)

## Agent

[`confluence-collaborate`](/reference/agents/confluence-collaborate) — A + C (untrusted comment / file / label content + per-page state change). NOT B. 2/3 — Rule of Two compliant; footer-default + path validation are the load-bearing mitigations.
