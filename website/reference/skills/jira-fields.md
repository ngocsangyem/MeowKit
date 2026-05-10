---
title: "mk:jira-fields"
description: "JIRA custom field discovery + agile field configuration."
---

# mk:jira-fields

## What This Skill Does

Forks the `jira-fields` agent to discover field IDs / names / scope, check per-project field availability, and configure agile field mappings (admin-only).

## When to Use

- **Triggers:** "field ID for X", "list custom fields", "check fields for project PROJ", "configure agile fields"
- **NOT for:** setting per-issue field values ([`mk:jira-issue`](/reference/skills/jira-issue) `update --custom-fields`).

## Required Permissions

`fields list`, `check-project` are open. `fields create`, `fields configure-agile` require Jira **Admin** — surface clearly on exit 3.

## Verified Wrapper Invocations

| Operation | Tier | Invocation |
|---|---|---|
| List all fields | 1 | `... fields list` |
| List by name pattern | 1 | `... fields list --search "story"` |
| Field detail | 1 | `... fields list --id customfield_10016` |
| Check project field availability | 1 | `... fields check-project PROJ` |
| Create custom field (admin) | 2 | `... fields create --name "..." --type <type>` |
| Configure agile mapping (admin) | 3 | `... fields configure-agile --board-id <ID> --story-points-field customfield_10016` |

## Custom Field ID Patterns

Cloud Jira uses `customfield_NNNNN`. Common defaults (verify per instance):

- Story Points: `customfield_10016`
- Sprint: `customfield_10020`
- Epic Link: `customfield_10014`
- Epic Name: `customfield_10011`

## Domain References

- `references/field-discovery.md` — discovery methodology
- `references/agile-field-ids.md` — typical agile field IDs (canonical source)
- `references/field-types-reference.md` — type-selection guide

## Peer Leaves

`mk:jira-issue` (sets field values per issue) · `mk:jira-agile` (consumes agile field IDs) · `mk:jira-admin` (broader admin surface)

## Agent

[`jira-fields`](/reference/agents/jira-fields) — A + C, NOT B.
