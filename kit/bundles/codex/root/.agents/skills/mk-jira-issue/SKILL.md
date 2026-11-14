---
name: "mk-jira-issue"
description: "JIRA issue CRUD via jira-as. NOT lifecycle (mk:jira-lifecycle), comments (mk:jira-collaborate), bulk (mk:jira-bulk), links (mk:jira-relationships), or time/sprint (mk:jira-time/agile)."
---

# mk:jira-issue

Forks to the `jira-issue` agent (system prompt at `.codex/agents/jira-issue.md`). The skill body is the task brief — the host runtime injects this content into the forked agent.

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