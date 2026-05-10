---
title: jira-issue
description: Jira issue CRUD agent — creates, reads, updates, and deletes individual Jira issues via the jira-as CLI wrapper.
---

# jira-issue

The jira-issue agent handles single-issue operations in Jira. It creates bugs, tasks, and stories, retrieves issue details, updates fields, and deletes issues — all through the `jira-as` CLI wrapper with built-in safety tiers that escalate confirmation requirements based on operation risk.

## Cognitive Framing

> *"One issue at a time. Read operations run immediately; destructive operations require dry-run confirmation."*

The jira-issue agent is a domain-specific agent for single-issue CRUD. It operates on demand and uses a 4-tier safety model: reads execute immediately, creates need no confirmation for single issues, updates show a diff before execution, and deletes require a dry-run review first.

## Key Facts

| | |
|---|---|
| **Type** | Domain (Jira) |
| **Phase** | On-demand |
| **Model** | inherit |
| **Color** | blue |
| **Safety** | 4-tier (read → create → modify → destructive) |
| **Never does** | Transition issues (jira-lifecycle), add comments (jira-collaborate), bulk operations (jira-bulk), link issues (jira-relationships) |

## When to Use

- When you need to **create a new bug, task, or story** in Jira.
- When you need to **view an issue's details** — summary, status, assignee, priority.
- When you need to **update fields** on an existing issue — summary, priority, labels, components.
- When you need to **delete an issue** (with mandatory dry-run first).

## Key Capabilities

- **Issue CRUD** — full create, read, update, and delete operations for single Jira issues.
- **Template support** — uses `bug`, `task`, and `story` templates for standardized issue creation.
- **Safety tiers** — graduated confirmation: Tier 1 (read, immediate), Tier 2 (create, none for single), Tier 3 (update, show diff), Tier 4 (delete, dry-run + confirm).
- **Field projection** — trims JSON output to essential fields (key, summary, status, assignee) using `jq` for readable results.

## Behavioral Checklist

- [x] Uses `jira-as` wrapper for all operations — never calls the Jira CLI directly
- [x] Shows current-vs-proposed diff before updates (Tier 3)
- [x] Runs `--dry-run` before deletes (Tier 4) and waits for user review
- [x] Projects output fields for readability
- [x] Runs `--help` for unfamiliar flags rather than guessing
- [x] Never writes ticket bodies, comment content, or token values to memory
- [x] Captures common project keys and custom field IDs in memory for future sessions

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Create a bug for the login issue" | Creates issue with `--type Bug`, `--project`, and `--summary` via template |
| "Show me PROJ-123" | Retrieves issue details with projected fields |
| "Update PROJ-123 priority to High" | Shows current vs proposed diff, then executes update |
| "Delete PROJ-456" | Runs `--dry-run` first, shows what would be deleted, waits for confirmation |

## Pro Tips

### Use Templates for Consistent Issues

The `bug`, `task`, and `story` templates ensure consistent issue creation across the team. Templates seed default fields and structure, reducing the chance of missing critical information.

### Capture Custom Field IDs Early

Custom field IDs vary per Jira instance. When the agent encounters a custom field, it records the ID and human-readable name in memory for future sessions, preventing repeated lookup overhead.

## Key Takeaway

The jira-issue agent provides safe, single-issue CRUD with graduated safety tiers that match confirmation requirements to operation risk. Reads are instant, creates are smooth, updates show diffs, and deletes always require dry-run review.

## Related Agents

- **[jira-lifecycle](/reference/agents/jira-lifecycle)** — handles transitions and workflow state changes (not CRUD)
- **[jira-collaborate](/reference/agents/jira-collaborate)** — handles comments, attachments, and watchers
- **[jira-bulk](/reference/agents/jira-bulk)** — handles operations on 10+ issues
- **[jira-search](/reference/agents/jira-search)** — finds issues by JQL criteria
