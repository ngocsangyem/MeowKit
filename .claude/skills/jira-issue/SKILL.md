---
name: mk:jira-issue
description: 'mk:jira leaf. Single-issue CRUD - create, read, update fields, delete. NOT for mk:jira-bulk.'
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
when_to_use: 'One Jira issue by key - open it, edit its fields, or delete it.'
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

## See also

- Agent: `../../agents/jira-issue.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/issue-templates.md` — canonical templates (Bug/Story/Epic/Task) + body markdown
  - `references/field-formats.md` — ADF, user assignment, custom-field formats
  - `references/decision-matrices.md` — issue-type / priority / template decision tables
- Peer leaves: `mk:jira-fields` (custom field IDs), `mk:jira-lifecycle` (post-create transitions), `mk:jira-collaborate` (comments/attachments), `mk:jira-relationships` (linking)

## Gotchas

- (none yet — grow from observed failures)
