# Sprint Operations — Board, Sprint CRUD, Velocity, Agile

---

## Board Operations

### List all boards

```
GET /rest/agile/1.0/board
```

Filter by project: `GET /rest/agile/1.0/board?projectKeyOrId=PROJECT_KEY`
Filter by name: `GET /rest/agile/1.0/board?name=BOARD_NAME`

Returns: `id`, `name`, `type` (scrum | kanban), `location.projectKey`

### Get board configuration

```
GET /rest/agile/1.0/board/{boardId}/configuration
```

Returns sprint settings, column mappings, estimation field, ranking field.

---

## Sprint Queries

### List sprints for a board

```
GET /rest/agile/1.0/board/{boardId}/sprint
```

Filter by state: `?state=active` | `?state=future` | `?state=closed`

Returns: `id`, `name`, `state`, `startDate`, `endDate`, `goal`

### Get active sprint

```
GET /rest/agile/1.0/board/{boardId}/sprint?state=active
```

Returns the currently running sprint(s). A board can have multiple active sprints if sub-sprints are enabled.

### Get sprint issues

```
GET /rest/agile/1.0/sprint/{sprintId}/issue
```

Optional: `?jql=status+%21%3D+Done` to filter within the sprint.

---

## Sprint CRUD

### Create sprint

```
POST /rest/agile/1.0/sprint
Body:
{
  "name": "Sprint 42",
  "originBoardId": BOARD_ID,
  "startDate": "2026-04-07T09:00:00.000Z",   // optional at creation
  "endDate": "2026-04-21T18:00:00.000Z",       // optional at creation
  "goal": "Launch user authentication"          // optional
}
```

Safety tier: Low (Tier 2) — reversible.

### Start sprint

```
POST /rest/agile/1.0/sprint/{sprintId}
Body:
{
  "state": "active",
  "startDate": "2026-04-07T09:00:00.000Z",
  "endDate": "2026-04-21T18:00:00.000Z"
}
```

Safety tier: Medium (Tier 3) — show sprint details before starting.

### Complete sprint

```
POST /rest/agile/1.0/sprint/{sprintId}
Body:
{
  "state": "closed"
}
```

Safety tier: High (Tier 4) — dry-run first showing incomplete issues and where they move.

**Dry-run output before closing:**
```
About to close: Sprint 42 (board: Team Alpha)
Completed: 18 issues
Incomplete (will move to backlog): 4 issues — PROJ-201, PROJ-207, PROJ-212, PROJ-219
Sprint dates: Apr 7 – Apr 21, 2026

Type "CONFIRM CLOSE SPRINT 42" to proceed.
```

---

## Add / Remove Issues from Sprint

### Add issues to sprint

```
POST /rest/agile/1.0/sprint/{sprintId}/issue
Body:
{
  "issues": ["PROJ-123", "PROJ-124", "PROJ-125"]
}
```

Safety tier: Low (Tier 2).

### Move issues to backlog (remove from sprint)

```
POST /rest/agile/1.0/backlog/issue
Body:
{
  "issues": ["PROJ-123", "PROJ-124"]
}
```

Safety tier: Low (Tier 2).

### Move issues between sprints

Move to specific sprint: Use add-to-sprint with target sprint ID.
For bulk moves (>10 issues): Tier 4 — dry-run + confirmation required.

---

## Velocity

### Query velocity via JQL

Velocity = story points completed per sprint. Approximate via JQL:

```jql
project = PROJECT_KEY AND sprint in closedSprints() AND status = Done
ORDER BY sprint DESC
```

Group results by sprint to see points completed per sprint.

### Formal velocity via Agile API

```
GET /rest/agile/1.0/rapid/charts/velocity?rapidViewId={boardId}
```

Returns per-sprint data: `estimated` and `completed` story points.

### Backlog prioritization

To surface highest-priority unplanned work:

```jql
project = PROJECT_KEY AND sprint is EMPTY AND status = "To Do"
ORDER BY priority ASC, rank ASC
```

Move top items into the next sprint using add-to-sprint operation.

---

## Agile Reporting Patterns

| Report | Approach |
|--------|----------|
| Sprint burndown | Get sprint issues + track status changes over time |
| Velocity trend | Query last N closed sprints, sum `Story Points` for Done issues |
| Capacity check | Sum story points in active sprint vs team velocity average |
| Backlog health | Count issues in backlog by age and priority |
| Cycle time | `status CHANGED TO "In Progress"` vs `status CHANGED TO Done` delta |

---

## Common Sprint Workflow

```
1. List boards           → find boardId
2. List future sprints   → find or confirm sprint to fill
3. JQL: backlog items    → identify candidates
4. Add issues to sprint  → fill the sprint
5. Start sprint          → confirm dates + goal
6. Daily: check sprint   → GET sprint issues, filter by status
7. Close sprint          → dry-run incomplete list, confirm, close
8. Velocity query        → check completed points vs estimate
```
