# Workflow Transitions — Common Jira Workflow Patterns

Jira workflows are project-specific. Always discover available transitions dynamically before attempting a transition. This file documents common patterns as reference.

---

## Discover Transitions Dynamically

Before transitioning, fetch available transitions for the issue:

```
GET /rest/api/3/issue/{issueKey}/transitions
```

Returns array of available transitions with `id`, `name`, and `to.name`. Use the `id` to execute the transition.

Never assume a transition exists — the project may use a custom workflow.

---

## Common Workflow Patterns

### Default Jira Workflow

```
Open → In Progress → Resolved → Closed
         ↑                ↓
         └──── Reopened ←─┘
```

Typical transition names: `Start Progress`, `Resolve Issue`, `Close Issue`, `Reopen Issue`

### Scrum / Software Workflow

```
To Do → In Progress → In Review → Done
  ↑          ↓            ↓
  └──────────┴────── Backlog (revert)
```

Typical transition names: `Start`, `Submit for Review`, `Approve`, `Reject`, `Complete`

### Kanban Workflow

```
Backlog → Selected for Development → In Progress → Done
              ↑                           ↓
              └───────── Blocked ─────────┘
```

Typical transition names: `Select`, `Start`, `Block`, `Unblock`, `Complete`

### QA Workflow (extended)

```
To Do → In Progress → In Review → In QA → Done
                         ↓           ↓
                     Rejected ← QA Failed
```

---

## Required Fields Per Transition

Some transitions require additional fields (resolution, comment, etc.). Discover them via:

```
GET /rest/api/3/issue/{issueKey}/transitions?expand=transitions.fields
```

Check `fields` on each transition object. Fields marked `required: true` must be provided.

Common required fields:
- `resolution` — required when closing/resolving (values: Fixed, Won't Fix, Duplicate, Cannot Reproduce, Done)
- `comment` — sometimes required on rejection transitions
- `assignee` — required on some "assign and start" transitions

---

## Executing a Transition

```
POST /rest/api/3/issue/{issueKey}/transitions
Body:
{
  "transition": { "id": "TRANSITION_ID" },
  "fields": {
    "resolution": { "name": "Fixed" }   // if required
  },
  "update": {
    "comment": [{ "add": { "body": "Transition reason..." } }]  // if required
  }
}
```

---

## Transition Safety Rules

| Scenario | Behavior |
|----------|----------|
| Transition not available | Report available transitions, ask user to pick |
| Required field missing | List missing fields before attempting transition |
| Transition to Done without resolution | Prompt for resolution value |
| Bulk transition (multiple issues) | Tier 4 safety — dry-run + confirmation required |

---

## Workflow State Mapping

When user says natural language like "move to done" or "mark as complete", map to actual transition:

| User intent | Likely transition name |
|-------------|----------------------|
| "start working" | Start, Start Progress, Begin |
| "move to review" | Submit for Review, In Review, Code Review |
| "mark done" / "close" | Done, Complete, Resolve, Close |
| "block it" | Blocked, On Hold |
| "reopen" | Reopen, To Do, Backlog |
| "reject" / "send back" | Reject, Needs Work, Return to Dev |

If multiple transitions match, show the options and ask user to confirm which one.
