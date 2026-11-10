---
name: mk:jira-fields
description: 'mk:jira leaf. Custom field discovery - field IDs, project scope, agile field config. NOT for mk:jira-issue.'
phase: on-demand
source: local
keywords:
  - jira
  - jira-fields
  - custom-fields
  - field-discovery
  - agile-field-config
when_to_use: 'Find a Jira custom field ID or check which fields a project exposes.'
user-invocable: true
context: fork
agent: jira-fields
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
---

# mk:jira-fields

Forks to the `jira-fields` agent. Most reads are open; `fields create` and `fields configure-agile` require **Admin** role.

## Triggers

- "what's the field ID for Story Points in PROJ?"
- "list all custom fields"
- "check which fields are available on project PROJ"
- "configure agile field mappings on board 42"

## Examples

- Discovery: "find the field ID for the 'Severity' custom field"
- Project check: "what fields can I set on PROJ-Bug?"
- Admin: "create a Number custom field named 'Estimated Cost'"

## Limitations

- `fields create` and `fields configure-agile` require Jira Admin. Insufficient permission → exit 3.

## See also

- Agent: `../../agents/jira-fields.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/field-discovery.md` — discovery methodology
  - `references/agile-field-ids.md` — typical agile field IDs (Sprint, Story Points, Epic Link)
  - `references/field-types-reference.md` — type-selection guide (text/select/multiselect/user/etc.)
- Peer leaves: `mk:jira-issue` (sets field values per issue), `mk:jira-agile` (consumes agile field IDs), `mk:jira-admin` (`admin notification-scheme` etc. — broader admin surface)

## Gotchas

- (none yet)
