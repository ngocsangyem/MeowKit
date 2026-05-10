---
title: jira-time
description: Jira time tracking agent — logs work, manages worklogs, sets estimates, generates time reports, and supports bulk time logging.
---

# jira-time

The jira-time agent manages all time tracking operations — logging work, managing worklogs, setting estimates, generating reports, and bulk-logging across multiple issues. It provides visibility into where time is being spent and helps teams track effort against estimates.

## Cognitive Framing

> *"Time data informs planning. Accurate time tracking reveals where estimates diverge from reality."*

The jira-time agent handles worklogs, estimates, and time-based reporting. It supports both single-issue time logging and bulk operations, with confirmations required before editing or deleting worklogs (which lose data permanently).

## Key Facts

| | |
|---|---|
| **Type** | Domain (Jira) |
| **Phase** | On-demand |
| **Model** | inherit |
| **Color** | orange |
| **Safety** | Tier 2 (log), Tier 3 (edit/estimate), Tier 4 (delete) |
| **Never does** | Sprint capacity planning (jira-agile), issue CRUD (jira-issue) |

## When to Use

- When you need to **log time worked** on an issue.
- When you need to **view or update worklogs** on an issue.
- When you need to **set or adjust time estimates**.
- When you need to **generate time reports** for a sprint or time period.
- When you need to **bulk-log time** across multiple issues using JQL.

## Key Capabilities

- **Work logging** — logs time spent on individual issues with comments.
- **Worklog management** — list, update, and delete existing worklogs. Edit and delete operations confirm first (data loss risk).
- **Estimate management** — sets original and remaining estimates on issues.
- **Time reporting** — generates reports showing time spent by sprint, project, or time period.
- **Bulk logging** — logs the same time duration across multiple issues matched by JQL.

## Behavioral Checklist

- [x] Logs time with appropriate duration format and optional comments
- [x] Confirms before editing or deleting worklogs (data loss risk)
- [x] Generates structured time reports with breakdowns
- [x] Supports bulk-logging across multiple issues via JQL
- [x] Never manages sprint capacity — that belongs to jira-agile

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Log 2 hours on PROJ-123" | Logs worklog with `time log PROJ-123 --duration 2h` |
| "Show worklogs for PROJ-123" | Lists all worklogs with time, author, and comments |
| "Set estimate to 8h for PROJ-123" | Sets remaining estimate via `time estimate` |
| "Time report for this sprint" | Generates report showing logged time by issue and team member |
| "Bulk-log 30 minutes to all review tasks" | Logs 30m to all issues matching the JQL query |

## Pro Tips

### Use Time Reports to Improve Estimates

Time reports reveal where estimates diverge from reality. If your team consistently underestimates testing tasks by 2x, that pattern should inform future sprint planning. The jira-time agent makes this data visible.

### Confirm Before Deleting Worklogs

Deleted worklogs cannot be recovered. The agent requires confirmation before any worklog deletion. If you need to correct a worklog, prefer updating (which preserves the entry) over deleting and re-creating.

## Key Takeaway

The jira-time agent provides accurate time tracking that feeds into better estimation and planning. By making time data visible and accessible, it closes the feedback loop between "what we estimated" and "what actually happened."

## Related Agents

- **[jira-issue](/reference/agents/jira-issue)** — handles issue CRUD; jira-time handles time-specific fields
- **[jira-agile](/reference/agents/jira-agile)** — handles sprint capacity; jira-time handles time logging
- **[jira-search](/reference/agents/jira-search)** — provides JQL queries used for bulk time operations
