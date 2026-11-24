---
name: mk:confluence-collaborate
description: "Confluence comments, labels. NOT for mk:confluence-page."
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
when_to_use: "Comment on a page."
user-invocable: true
context: fork
agent: confluence-collaborate
owner: confluence
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["confluence"]
default_enabled: false
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

- Upload paths are validated in `references/attachment-conventions.md`; read it before any upload.
- Confluence comments have no internal/public flag (unlike Jira Service Management); footer vs inline is the nearest boundary, so the agent prefers footer.
- An inline comment needs an anchor selection; if the text is not unique on the page the call fails with a 400-class error.
- Labelling 10+ pages goes through `mk:confluence-bulk`; single-page label add/remove stays here.
- The lossy-ADF warning is in `../confluence/references/cli-idioms.md`.
