---
name: mk:jira-collaborate
description: "Manage JIRA collaboration surface via the jira-as wrapper: comments, attachments, watchers, notify. Triggers: 'comment on KEY', 'add attachment to KEY', 'watch KEY', 'notify KEY watchers'. Internal-vs-public comment safety enforced. NOT for issue CRUD (mk:jira-issue); NOT for issue links (mk:jira-relationships)."
phase: on-demand
source: local
keywords: [jira, jira-collaborate, jira-comment, jira-attachment, jira-watcher, jira-notify]
when_to_use: "Use to add/list/update/delete comments, attachments, or watchers on a Jira issue, or to send notifications. NOT for issue field updates."
user-invocable: true
context: fork
agent: jira-collaborate
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
