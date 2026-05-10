---
name: mk:jira-agile
description: "JIRA agile via the jira-as wrapper: epics, sprints, backlog, ranking, story points, subtasks, velocity. Triggers: 'create sprint', 'add KEY to sprint', 'set story points on KEY', 'rank KEY before KEY', 'velocity for board', 'epic add'. Board ID ≠ project key. NOT for issue CRUD (mk:jira-issue); NOT for time tracking (mk:jira-time)."
phase: on-demand
source: meowkit
keywords: [jira, jira-agile, jira-sprint, jira-epic, jira-backlog, story-points, velocity]
when_to_use: "Use to manage epics, sprints, backlog, ranking, story-point estimates, subtasks, or velocity reports. NOT for individual issue CRUD."
user-invocable: true
context: fork
agent: jira-agile
---

# mk:jira-agile

Forks to the `jira-agile` agent. Sprint operations require a numeric `--board-id`, not the project key. The agent resolves project name → board ID via `agile board list --name "..."` first.

## Triggers

- "list sprints on board 'Team Alpha'"
- "add PROJ-123, PROJ-124 to sprint 42"
- "set 5 story points on PROJ-123"
- "rank PROJ-123 before PROJ-456 in backlog"
- "velocity for board 42"
- "create epic 'Auth Rewrite' in PROJ"

## Examples

- Sprint create: "create sprint 'Sprint 21' on board 'Team Alpha' from 2026-05-13 to 2026-05-27"
- Epic populate: "add PROJ-123, PROJ-124, PROJ-125 to epic EPIC-1"
- Subtask: "create subtask of PROJ-123 — 'write integration test'"

## See also

- Agent: `../../agents/jira-agile.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/sprint-operations.md` — board/sprint/velocity wrapper patterns
  - `references/agile-field-reference.md` — agile-specific field IDs (Sprint, Epic Link, Story Points)
- Peer leaves: `mk:jira-fields` (`references/agile-field-ids.md` is the canonical instance-discovery source), `mk:jira-time` (capacity = velocity ÷ team time), `mk:jira-relationships` (epic-children outside epic-link via issue links)

## Gotchas

- (none yet — grow from observed failures)
