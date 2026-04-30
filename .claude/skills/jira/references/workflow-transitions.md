# Workflow Transitions — Common Jira Patterns

Jira workflows are project-specific. Always discover available transitions dynamically before attempting a transition.

## Discover Transitions

Before transitioning, fetch available transitions for the issue via Atlassian MCP.
Returns available transitions with `id`, `name`, and `to.name`. Use the `id` to execute.

Never assume a transition exists — the project may use a custom workflow.

## Common Workflow Patterns

### Default Jira
```
Open → In Progress → Resolved → Closed
         ↑                ↓
         └──── Reopened ←─┘
```

### Scrum / Software
```
To Do → In Progress → In Review → Done
  ↑          ↓            ↓
  └──────────┴────── Backlog (revert)
```

### Kanban
```
Backlog → Selected for Development → In Progress → Done
```

## Required Fields Per Transition

Some transitions require additional fields. Common required fields:
- `resolution` — required when closing/resolving (Fixed, Won't Fix, Duplicate, Done)
- `comment` — sometimes required on rejection transitions
- `assignee` — required on some "assign and start" transitions

## Natural Language Mapping

| User intent | Likely transition |
|-------------|------------------|
| "start working" | Start, Start Progress, Begin |
| "move to review" | Submit for Review, In Review |
| "mark done" / "close" | Done, Complete, Resolve, Close |
| "block it" | Blocked, On Hold |
| "reopen" | Reopen, To Do, Backlog |
| "reject" / "send back" | Reject, Needs Work, Return to Dev |

If multiple transitions match, show options and ask user to confirm.

## Safety

| Scenario | Behavior |
|----------|----------|
| Transition not available | Report available transitions, ask user to pick |
| Required field missing | List missing fields before attempting |
| Bulk transition | Tier 4 — dry-run + confirmation |
