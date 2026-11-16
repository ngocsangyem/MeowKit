---
name: "mk-jira-agile"
description: "Jira epics, sprints, backlog, ranking, points; use to move items between sprints."
---

# mk-jira-agile

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

## Sprint commitment hooks (Agile-context-only — gated by `agile-sprint-commitment.md` 2/3 when loaded)

When `tasks/contracts/sprint-state-{date}-sprint-{N}.md` exists with `status: active`, wrap these operations:

### `sprint add KEY` and `sprint remove KEY` (post-start)

1. Read newest sprint-state file matching the active sprint
2. **Acquire `flock` on the sprint-state file before any read-modify-write.** YAML frontmatter append is non-atomic across shells; lock is the only mitigation
3. Per `agile-sprint-commitment.md` 2: ask the user "Reason for mid-sprint scope change?" — required free-text
4. Append `{ ts: <ISO ts>, action: add|remove, ticket: KEY, reason: <text> }` to `amendments:` list
5. Release lock
6. Proceed with the underlying `jira-as agile sprint add|remove` call

If sprint-state contract is absent OR `status: closed` → skip the amendment ceremony silently.

### `sprint close`

1. Read `committed_tickets:` from newest active sprint-state
2. Query each via `mk-jira-issue get KEY`
3. For each non-terminal ticket (not Done/Cancelled/Won't-Do), ask the user: "PROJ-X is in {status}. Carry over to next sprint? Drop? Mark as not delivered?"
4. Write closure summary: `status: closed`, `closed_at: <ts>`, `delivered: [...]`, `carried_over: [...]`
5. Proceed with the underlying `jira-as agile sprint close` call

### File-class scope (sprint-state vs sprint-contract)

Two file classes share `tasks/contracts/`. Per-story sprint-CONTRACT files carry
`contract_schema_version` and `### [AC-N]` entries and follow
`mk-sprint-contract/assets/contract-template.md`. Sprint-STATE files at
`sprint-state-{date}-sprint-{N}.md` follow `assets/sprint-state-template.md` instead and
have none of those fields by design. Neither class has a validator: YAML is parsed inline
by this skill, `mk-agent-detector`, and `mk-sprint-contract sprint-goal`.

### Glob-collision safety verified

A per-task contract glob (`tasks/contracts/*-"$slug"-sprint-*.md`) cannot match a
sprint-state file: a sprint-state name has no slug between its leading `sprint-state-`
prefix and `-sprint-`. Reading either class by an explicit path is unambiguous.

## See also

- Agent: `../../agents/jira-agile.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/sprint-operations.md` — board/sprint/velocity wrapper patterns
  - `references/agile-field-reference.md` — agile-specific field IDs (Sprint, Epic Link, Story Points)
- Peer leaves: `mk-jira-fields` (`../jira-fields/references/agile-field-ids.md` is the canonical instance-discovery source), `mk-jira-time` (capacity = velocity ÷ team time), `mk-jira-relationships` (epic-children outside epic-link via issue links)

## Gotchas

- (none yet — grow from observed failures)