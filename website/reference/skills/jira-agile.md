---
title: "mk:jira-agile"
description: "JIRA agile: epics, sprints, backlog, ranking, story points, subtasks, velocity."
---

# mk:jira-agile

## What This Skill Does

Forks the `jira-agile` agent to drive the agile layer: epics, sprints, backlog, ranking, story points, subtasks, velocity reports. Sprint operations require a numeric `--board-id`, not the project key.

## When to Use

- **Triggers:** "list sprints on board X", "add PROJ-123 to sprint", "set 5 story points", "rank PROJ-123 before PROJ-456", "velocity for board", "create epic"
- **NOT for:** issue CRUD ([`mk:jira-issue`](/reference/skills/jira-issue)) · time tracking ([`mk:jira-time`](/reference/skills/jira-time)).

## Board ID ≠ Project Key (critical)

Sprint ops need a numeric `board_id`, not `PROJ`. Resolve human board names first:

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh agile board list --name "Team Alpha"
```

Mixing project keys and board IDs is the #1 source of "board not found" errors.

## Verified Wrapper Invocations

| Operation | Tier | Invocation |
|---|---|---|
| List boards | 1 | `... agile board list [--name "..."]` |
| List sprints | 1 | `... agile sprint list --board-id <ID>` |
| Sprint create | 2 | `... agile sprint create --board-id <ID> --name "..." --start <ISO> --end <ISO>` |
| Add to sprint | 3 | `... agile sprint add --sprint-id <ID> --issues PROJ-1,PROJ-2` |
| Backlog | 1 | `... agile backlog --board-id <ID>` |
| Set story points | 3 | `... agile estimate PROJ-123 --points 5` |
| Velocity | 1 | `... agile velocity --board-id <ID>` |
| Epic create | 2 | `... agile epic create --project PROJ --name "Epic Name"` |
| Epic add issue | 3 | `... agile epic add EPIC-1 --issues PROJ-1,PROJ-2` |
| Subtask create | 2 | `... agile subtask create PARENT-1 --summary "..."` |

## Domain References

- `references/sprint-operations.md` — board / sprint / velocity wrapper patterns
- `references/agile-field-reference.md` — agile-specific field IDs (Sprint, Epic Link, Story Points)

## Peer Leaves

`mk:jira-fields` (canonical instance-discovery: `references/agile-field-ids.md`) · `mk:jira-time` (capacity = velocity ÷ team time) · `mk:jira-relationships` (epic-children outside epic-link)

## Agent

[`jira-agile`](/reference/agents/jira-agile) — A + C, NOT B.

## Sprint Commitment Hooks (Agile mode)

When `tasks/contracts/sprint-state-{date}-sprint-{N}.md` exists with `status: active`, governed by `.claude/rules-conditional/agile-sprint-commitment.md` (loaded only when Agile context detected):

### `sprint add KEY` and `sprint remove KEY` (post-start)

1. Read newest sprint-state file matching the active sprint
2. Acquire `flock` on the sprint-state file (concurrent-write safety — YAML frontmatter append is non-atomic across shells)
3. AskUserQuestion: "Reason for mid-sprint scope change?" — required free-text
4. Append `{ ts, action: add|remove, ticket, reason }` to `amendments:` list
5. Release lock; proceed with the underlying jira-as call

If sprint-state contract is absent OR `status: closed`, the amendment ceremony is skipped silently.

### `sprint close`

1. Read `committed_tickets:` from newest active sprint-state
2. Query each via `mk:jira-issue get KEY`
3. For each non-terminal ticket (not Done/Cancelled/Won't-Do): "PROJ-X is in {status}. Carry over? Drop? Mark not delivered?"
4. Write closure summary: `status: closed`, `closed_at`, `delivered: [...]`, `carried_over: [...]`
5. Proceed with the underlying jira-as call

### Validator scope (sprint-state vs sprint-contract)

- `mk:sprint-contract/scripts/validate-contract.sh` validates per-story sprint-CONTRACT files only
- Sprint-STATE files have NO validator — YAML parsed inline by this skill, `mk:agent-detector`, and `mk:sprint-contract sprint-goal`
- Do not invoke `validate-contract.sh` on a sprint-state path; it WILL fail (sprint-state lacks contract schema fields by design)
