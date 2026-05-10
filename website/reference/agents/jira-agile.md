---
title: jira-agile
description: Jira agile agent — manages epics, sprints, backlog, ranking, story points, subtasks, and velocity reports.
---

# jira-agile

The jira-agile agent manages the agile layer in Jira — epics, sprints, backlog ordering, issue ranking, story points, subtasks, and velocity reports. It understands the critical distinction that Board ID is not the same as Project Key, preventing a common source of API errors.

## Cognitive Framing

> *"Board ID is not Project Key. This distinction prevents the most common agile API error."*

The jira-agile agent drives sprint and epic management. Its most important technical insight is that Jira boards and projects are separate entities with different IDs — confusing them causes silent failures in sprint and backlog operations. The agent validates this mapping before any operation.

## Key Facts

| | |
|---|---|
| **Type** | Domain (Jira) |
| **Phase** | On-demand |
| **Model** | inherit |
| **Color** | pink |
| **Safety** | Tier 2 (create sprint), Tier 3 (modify), Tier 4 (delete) |
| **Never does** | Issue CRUD (jira-issue), issue links (jira-relationships), time tracking (jira-time) |

## When to Use

- When you need to **manage sprints** — create, start, close, or list.
- When you need to **manage epics** — create, add issues, or track progress.
- When you need to **reorder the backlog** or rank issues.
- When you need to **set story points** on issues.
- When you need to **create subtasks** under a parent issue.
- When you need **velocity reports** for sprint planning.

## Key Capabilities

- **Sprint management** — creates, starts, closes, and lists sprints. Adds and removes issues from sprints.
- **Epic management** — creates epics, adds issues to epics, and tracks epic progress.
- **Backlog management** — reorders backlog and ranks issues relative to each other.
- **Story points** — sets and updates story point estimates on issues.
- **Subtask management** — creates subtasks under parent issues.
- **Velocity reporting** — generates velocity data for boards to inform sprint capacity planning.
- **Board-Project mapping** — validates that Board ID and Project Key are correctly mapped before operations.

## Behavioral Checklist

- [x] Validates Board ID ≠ Project Key before sprint and backlog operations
- [x] Creates sprints with proper board context
- [x] Ranks issues using correct relative positioning
- [x] Sets story points using the project's custom field ID
- [x] Generates velocity data for informed sprint planning
- [x] Never confuses board-level and project-level operations

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Create a new sprint" | Creates sprint on the correct board (validates Board ID first) |
| "Add PROJ-123 to the current sprint" | Adds issue to the active sprint |
| "Set story points to 5 for PROJ-123" | Sets story points using the project's custom field |
| "Rank PROJ-123 before PROJ-124" | Reorders backlog to place PROJ-123 higher |
| "Show velocity for the last 3 sprints" | Generates velocity report from board data |
| "Create subtask under PROJ-100" | Creates a subtask linked to the parent issue |

## Pro Tips

### Validate Board ID Before Sprint Operations

The most common agile API error is using a Project Key where a Board ID is expected (or vice versa). The agent validates this mapping before every operation, but understanding this distinction helps when debugging sprint management issues.

### Use Velocity Data for Realistic Planning

Velocity reports show how many story points your team actually completes per sprint — not how many they plan to complete. Use this data to set realistic sprint capacity rather than aspirational goals.

## Key Takeaway

The jira-agile agent provides safe agile management with the critical Board ID ≠ Project Key validation that prevents the most common source of sprint API errors. By separating agile concerns from issue CRUD and time tracking, it maintains clear responsibility boundaries.

## Related Agents

- **[jira-issue](/reference/agents/jira-issue)** — handles issue CRUD; jira-agile handles sprint and epic membership
- **[jira-time](/reference/agents/jira-time)** — handles time logging; jira-agile handles sprint capacity
- **[jira-relationships](/reference/agents/jira-relationships)** — handles issue links; jira-agile handles parent/subtask hierarchy
- **[jira-fields](/reference/agents/jira-fields)** — discovers custom field IDs used for story points and sprints
