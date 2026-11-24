---
name: mk:jira-collaborate
description: "mk:jira leaf: comments, watchers. NOT for mk:jira-relationships."
phase: on-demand
source: local
keywords:
  - jira
  - jira-collaborate
  - jira-comment
  - jira-attachment
  - jira-watcher
  - jira-notify
when_to_use: "Comment or watch."
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

Forks to the `jira-collaborate` agent. This leaf owns the visibility rule: a core Jira comment is visible to everyone who can see the issue unless restricted with `--visibility-role` or `--visibility-group`; an agent-only comment on a JSM request uses `jsm request comment --internal`. The agent confirms visibility for any comment that could be customer-facing and restricts it when uncertain.

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
  - `references/comment-formats.md` — text / markdown / ADF format reference, and the one place markdown-to-ADF conversion is explained
- Peer leaves: `mk:jira-issue` (create-with-attachment), `mk:jira-jsm` (JSM requests; follows the visibility rule above), `mk:jira-analyst` (post-analysis comment patterns)

## Gotchas

- (none yet — grow from observed failures)
