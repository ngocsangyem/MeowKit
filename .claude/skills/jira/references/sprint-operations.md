# Sprint Operations — Board, Sprint CRUD, Velocity

All operations use Atlassian MCP — no direct REST calls.

## Board Operations

- **List boards:** filter by project key or board name
- **Get board config:** returns sprint settings, column mappings, estimation field

## Sprint Queries

- **List sprints:** filter by state (active, future, closed)
- **Get active sprint:** returns currently running sprint(s)
- **Get sprint issues:** issues in a specific sprint, optionally filtered by JQL

## Sprint CRUD

| Operation | Safety Tier | Notes |
|-----------|------------|-------|
| Create sprint | Tier 2 (Low) | Reversible. Name, board, dates, goal |
| Start sprint | Tier 3 (Medium) | Show sprint details before starting |
| Complete sprint | Tier 4 (High) | Dry-run first: show incomplete issues and destination |

**Dry-run output before closing:**
```
About to close: Sprint 42 (board: Team Alpha)
Completed: 18 issues
Incomplete (will move to backlog): 4 issues — PROJ-201, PROJ-207, PROJ-212, PROJ-219

Type "CONFIRM CLOSE SPRINT 42" to proceed.
```

## Add / Remove Issues

| Operation | Safety Tier |
|-----------|------------|
| Add issues to sprint | Tier 2 |
| Move issues to backlog | Tier 2 |
| Bulk move (>10 issues) | Tier 4 — dry-run + confirmation |

## Velocity

Approximate via JQL:
```jql
project = PROJECT_KEY AND sprint in closedSprints() AND status = Done ORDER BY sprint DESC
```
Group results by sprint to see points completed per sprint.

## Common Workflow

1. List boards → find boardId
2. List future sprints → identify target sprint
3. JQL: backlog items → identify candidates
4. Add issues to sprint → fill the sprint
5. Start sprint → confirm dates + goal
6. Close sprint → dry-run, confirm, close
