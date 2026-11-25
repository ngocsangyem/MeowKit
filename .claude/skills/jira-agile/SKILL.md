---
name: mk:jira-agile
description: "mk:jira leaf: epics, sprints, backlog. NOT for mk:jira-estimator."
phase: on-demand
source: local
keywords:
  - jira
  - jira-agile
  - jira-sprint
  - jira-epic
  - jira-backlog
  - story-points
  - velocity
when_to_use: "Sprint moves."
user-invocable: true
context: fork
agent: jira-agile
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
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

## Sprint commitment

When `tasks/contracts/sprint-state-*.md` has `status: active`, follow `.claude/skills/agent-detector/references/agile-sprint-commitment.md` section 2 before `sprint add|remove` and section 3 before `sprint close`. Lock the sprint-state file before appending: concurrent appends are non-atomic. With no active sprint-state, skip the ceremony.

## See also

- Agent: `../../agents/jira-agile.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/sprint-operations.md` — board/sprint/velocity wrapper patterns
  - `references/agile-field-reference.md` — agile-specific field IDs (Sprint, Epic Link, Story Points)
- Peer leaves: `mk:jira-fields` (`../jira-fields/references/agile-field-ids.md` is the canonical instance-discovery source), `mk:jira-time` (capacity = velocity ÷ team time), `mk:jira-relationships` (epic-children outside epic-link via issue links)
