---
title: jira-admin
description: Jira administration agent — manages projects, users, groups, schemes, and automation across 11 sub-domains with admin-level permissions.
---

# jira-admin

The jira-admin agent handles Jira instance administration — creating and configuring projects, managing users and groups, setting up permission and notification schemes, and configuring automation. It spans 11 sub-domains with approximately 65 operations, all requiring admin-level permissions. Destructive operations use a 2-step confirmation that requires typing the exact target identifier.

## Cognitive Framing

> *"Admin operations have the highest blast radius. Archive before delete. Confirm before destroy."*

The jira-admin agent is the highest-blast-radius Jira agent. Every operation requires admin permissions, and destructive operations (project delete, user delete, group delete) use a 2-step token confirmation where the user must type the exact target identifier to proceed. The agent always offers archive or deactivation as the first option before deletion.

## Key Facts

| | |
|---|---|
| **Type** | Domain (Jira) |
| **Phase** | On-demand |
| **Model** | inherit |
| **Color** | red |
| **Required permissions** | Jira Admin (some require Site Admin) |
| **Safety** | 2-step token confirmation for destructive operations |
| **Never does** | Per-issue CRUD (jira-issue), sprint management (jira-agile), JSM administration (jira-jsm) |

## When to Use

- When you need to **create, configure, or delete projects**.
- When you need to **manage users** — list, deactivate, or delete.
- When you need to **manage groups** — create, add/remove members.
- When you need to **set up permission or notification schemes**.
- When you need to **configure automation rules or templates**.

## Sub-Domains (11)

| Sub-domain | Description |
|---|---|
| `project` | Create, configure, archive, delete projects |
| `config` | Project configuration settings |
| `category` | Project categories |
| `user` | User management (list, deactivate, delete) |
| `group` | Group management (create, membership, delete) |
| `automation` | Automation rule management |
| `automation-template` | Automation templates |
| `permission-scheme` | Permission scheme CRUD |
| `permission` | Individual permission grants |
| `notification-scheme` | Notification scheme CRUD |
| `notification` | Notification configuration |

## Behavioral Checklist

- [x] Verifies admin permissions before operations
- [x] Uses 2-step token confirmation for destructive operations (project/user/group delete)
- [x] Always offers archive (project) or deactivate (user) as the first option before delete
- [x] Requires typing the exact target identifier for delete confirmation
- [x] Reports the blast radius of admin operations before execution
- [x] Never performs per-issue operations — routes those to jira-issue

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Create a new Scrum project" | Creates project with `admin project create --key NEW --type software-scrum` |
| "List all users" | Lists users via `admin user list` |
| "Delete project PROJ" | Runs `--dry-run` first, offers archive as alternative, requires 2-step token confirmation |
| "Deactivate user john.doe" | Deactivates user account (preferred over delete) |
| "Add user to the developers group" | Adds member via `admin group add-member` |

## Pro Tips

### Always Prefer Archive Over Delete

Deleted projects, users, and groups cannot be recovered. The agent always offers archive (for projects) or deactivation (for users) as the first option. Only proceed with deletion when you are certain the data is no longer needed.

### Map Permission Schemes Before Project Creation

Setting up permission schemes before creating projects ensures consistent access control from day one. Creating a project first and configuring permissions later often results in temporarily overprivileged access.

## Key Takeaway

The jira-admin agent provides controlled access to Jira's highest-impact operations with 2-step confirmation gates that prevent accidental destruction. By defaulting to reversible actions (archive, deactivate) over irreversible ones (delete), it minimizes the risk of permanent data loss.

## Related Agents

- **[jira-issue](/reference/agents/jira-issue)** — handles per-issue CRUD (not admin-level)
- **[jira-jsm](/reference/agents/jira-jsm)** — handles JSM-specific administration
- **[jira-fields](/reference/agents/jira-fields)** — handles custom field discovery and configuration
