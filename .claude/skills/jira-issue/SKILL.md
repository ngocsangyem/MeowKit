---
name: mk:jira-issue
description: "mk:jira leaf: create, read, update, delete one issue. NOT for mk:jira-bulk."
phase: on-demand
source: local
keywords:
  - jira
  - jira-issue
  - issue-crud
  - create-issue
  - get-issue
  - update-issue
  - delete-issue
when_to_use: "One issue by key."
user-invocable: true
context: fork
agent: jira-issue
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
---

# mk:jira-issue

Forks to the `jira-issue` agent (system prompt at `.claude/agents/jira-issue.md`). The skill body is the task brief — the host runtime injects this content into the forked agent.

## Triggers

- "create a bug/task/story in PROJ"
- "show me / get / view / look up PROJ-123"
- "update PROJ-123 priority to High"
- "delete PROJ-123"

## Examples

- Quick create: "create a Bug in PROJ titled 'Login fails on Safari'"
- Templated create: "create a story from the bug template for PROJ"
- Read with projection: "show me PROJ-123 with comments and attachments"
- Update: "set priority to High and add label tech-debt on PROJ-123"

## Delete

Deleting an issue is destructive: show the issue key and summary and get the user's explicit "yes" first (`../jira/references/safety-framework.md`, Tier 4). `issue delete --force` skips the CLI's own prompt, so use it only after that "yes".

## See also

- Agent: `../../agents/jira-issue.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/issue-templates.md` — read when creating: canonical templates (Bug/Story/Epic/Task) + body markdown
  - `references/field-formats.md` — read when setting custom fields or user assignment
  - `references/decision-matrices.md` — read only when the issue type, priority or template is unclear
- Peer leaves: `mk:jira-fields` (custom field IDs), `mk:jira-lifecycle` (post-create transitions), `mk:jira-collaborate` (comments/attachments), `mk:jira-relationships` (linking)
