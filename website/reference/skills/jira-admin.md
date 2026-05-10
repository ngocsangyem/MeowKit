---
title: "mk:jira-admin"
description: "JIRA project / user / group / scheme / automation administration. Requires admin. Highest blast radius."
---

# mk:jira-admin

## What This Skill Does

Forks the `jira-admin` agent to execute project / user / group / scheme / automation administration across 11 sub-domains (~65 verbs). Highest-blast-radius leaf in the family.

## When to Use

- **Triggers:** "create JIRA project", "list users", "delete user", "list permission schemes", "create group"
- **NOT for:** per-issue ops ([`mk:jira-issue`](/reference/skills/jira-issue) / [`mk:jira-lifecycle`](/reference/skills/jira-lifecycle)) · JSM admin ([`mk:jira-jsm`](/reference/skills/jira-jsm)).

## Required Permissions

Every verb requires Jira **Admin**. Some verbs require **Site Admin**. Insufficient permission → exit code 3.

## DESTRUCTIVE Operations (2-step token confirmation)

For irreversible ops, the agent enforces:

1. Show the user exactly what will be deleted
2. Require the user to **type the literal target identifier** (e.g. project key `STAGING`)
3. Only then re-invoke without `--dry-run`

Irreversible ops:

- `admin project delete` — IRREVERSIBLE; deletes all issues, attachments, history
- `admin user delete` — IRREVERSIBLE (use `deactivate` instead when possible)
- `admin group delete` (with members) — affects member access globally

## Sub-Domains (11)

| Sub-domain | Common verbs |
|---|---|
| `project` | `list`, `create`, `get`, `update`, `archive`, `delete`, `lead` |
| `config` | `get`, `update`, `restore-defaults` |
| `category` | `list`, `create`, `update`, `delete` |
| `user` | `list`, `create`, `get`, `update`, `deactivate`, `delete`, `groups` |
| `group` | `list`, `create`, `get`, `delete`, `add-member`, `remove-member` |
| `automation` | `list`, `enable`, `disable`, `delete`, `run` |
| `automation-template` | `list`, `apply` |
| `permission-scheme` | `list`, `get`, `create`, `update`, `delete`, `assign-to-project` |
| `permission` | `list`, `grant`, `revoke` |
| `notification-scheme` | `list`, `get`, `create`, `update`, `delete`, `assign-to-project` |
| `notification` | `list`, `add`, `remove` |

## Recovery — Prefer Archive over Delete

For projects, the agent **always offers archive as the first choice** even when the user says "delete":

> "Delete is irreversible. Archive hides the project but preserves data. Most cleanup intents map to archive. Are you SURE you need delete?"

For users, **always offer deactivate** as the first choice — it disables the account but preserves attribution on existing issues.

## Domain References

- `references/voodoo-constants.md` — magic numbers (event IDs, scheme IDs, common custom field IDs) and how to discover yours

## Peer Leaves

`mk:jira-fields` (admin overlap; `fields create` requires admin) · `mk:jira-jsm` (JSM-specific admin lives there)

## Agent

[`jira-admin`](/reference/agents/jira-admin) — A + C, NOT B.
