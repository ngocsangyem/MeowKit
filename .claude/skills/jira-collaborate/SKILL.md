---
name: mk:jira-collaborate
description: 'mk:jira leaf. Comments, attachments, watchers, notifications. NOT for mk:jira-relationships.'
phase: on-demand
source: local
keywords:
  - jira
  - jira-collaborate
  - jira-comment
  - jira-attachment
  - jira-watcher
  - jira-notify
when_to_use: 'Comment on a Jira issue, attach a file, or manage its watchers.'
user-invocable: true
context: fork
agent: jira-collaborate
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
---

# mk:jira-collaborate

Forks to the `jira-collaborate` agent. The agent confirms internal-vs-public for any comment that could be customer-facing (default `internal` if uncertain).

## Triggers

- "add comment to PROJ-123: '<text>'"
- "list comments on PROJ-123"
- "upload screenshot.png to PROJ-123"
- "watch PROJ-123" / "stop watching PROJ-123"
- "notify PROJ-123 watchers about <message>"

## Examples

- Internal comment: "add internal comment to PROJ-123: 'awaiting backend fix'"
- Attachment upload: "attach /tmp/repro.mp4 to PROJ-123"
- Watcher list: "who watches PROJ-123?"

## See also

- Agent: `../../agents/jira-collaborate.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/comment-templates.md` — copy-paste comment templates (progress, blocker, handoff, evidence)
  - `references/comment-formats.md` — text / markdown / ADF format reference
- Peer leaves: `mk:jira-issue` (create-with-attachment), `mk:jira-jsm` (internal-vs-public on JSM tickets), `mk:jira-analyst` (post-analysis comment patterns)

## Gotchas

- (none yet — grow from observed failures)
