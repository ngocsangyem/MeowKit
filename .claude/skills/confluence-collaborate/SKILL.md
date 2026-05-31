---
name: mk:confluence-collaborate
description: 'Manage Confluence collaboration surface via the confluence-as wrapper: comments, attachments, labels, watchers. Triggers: ''add comment to page 12345'', ''upload attachment to page 12345'', ''label page 12345 as urgent'', ''watch page 12345''. Inline-vs-footer comment safety enforced. NOT for page CRUD (mk:confluence-page); NOT for bulk ops (mk:confluence-bulk).'
phase: on-demand
source: local
keywords:
  - confluence-collaborate
  - page-comment
  - page-attachment
  - page-label
  - page-watcher
  - footer-comment
  - inline-comment
when_to_use: Use to add/list/update/delete comments, attachments, labels, or watchers on a single Confluence page. NOT for page field updates (use mk:confluence-page).
user-invocable: true
context: fork
agent: confluence-collaborate
owner: confluence
criticality: medium
status: active
runtime: claude-code
---

# mk:confluence-collaborate

Forks to the `confluence-collaborate` agent. The agent prefers footer comments over inline; asks before posting an inline comment.

## Triggers

- "add comment to page 12345: '<text>'"
- "list comments on page 12345"
- "upload screenshot.png to page 12345"
- "label page 12345 as 'urgent'"
- "remove label 'draft' from page 12345"
- "watch page 12345" / "stop watching page 12345"
- "list watchers of page 12345"

## Examples

- Footer comment: "add comment to 12345: 'awaiting backend fix'"
- Attachment upload: "attach /tmp/repro.mp4 to page 12345"
- Label add: "label 12345 as 'rfc'"
- Watcher list: "who watches page 12345?"

## See also

- Agent: `../../agents/confluence-collaborate.md`
- Shared: `../confluence/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/comment-formats.md` — inline vs footer, markdown vs storage format
  - `references/attachment-conventions.md` — file size limits, allowed types, download paths
- Peer leaves: `mk:confluence-page` (page CRUD; create-with-attachment), `mk:confluence-bulk` (bulk-label across 10+ pages), `mk:confluence-spec-analyst` (downloads attachments for image analysis)

## Gotchas

- `validate_file_path` in `confluence-as` rejects `..` traversal but delegates to opaque `assistant-skills-lib`. Don't trust delegation alone — the agent independently validates upload paths at the agent boundary too. [from research]
- Confluence Cloud comments do NOT have a strict internal/public flag like Jira Service Management. Inline vs footer is the closest semantic boundary — agent prefers footer. [from jira-collaborate parallel pattern]
- Inline comment requires an anchor selection. If the selection text doesn't match unique content on the page, the comment fails with a 400-class error.
- Bulk-label across 10+ pages goes through `mk:confluence-bulk`, NOT this skill. Single-page label add/remove only here.
- Grow this list as new edge cases surface.
