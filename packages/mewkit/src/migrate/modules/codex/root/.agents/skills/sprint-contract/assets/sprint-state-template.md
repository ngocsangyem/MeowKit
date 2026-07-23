---
sprint_id: <number>
sprint_goal: "<one-line outcome-focused statement, ≤120 chars>"
start_date: <YYYY-MM-DD>
end_date: <YYYY-MM-DD>
team: "<optional team name>"
committed_tickets: []     # Filled at sprint planning
amendments: []            # Append-only; entry shape: { ts, action: add|remove, ticket, reason }
status: active            # active | closed
closed_at: null
delivered: []             # Filled at sprint close
carried_over: []          # Filled at sprint close
---

<!--
SPRINT-STATE CONTRACT — sprint-LEVEL contract (one per sprint).

Distinct from per-story `sprint-contract` (one per story per sprint).
Path: tasks/contracts/sprint-state-{date}-sprint-{N}.md

Owner skills:
- mk:sprint-contract sprint-goal — writes sprint_goal, creates this file if absent
- mk:jira-agile sprint add|remove — appends to amendments (with flock)
- mk:jira-agile sprint close — writes status:closed, delivered, carried_over

Rule body: .agents/skills/rule-agile-sprint-commitment.md

Concurrent-write safety: writers MUST acquire flock(1) on this file before
any read-modify-write cycle. YAML frontmatter append is non-atomic across
shells; flock is the only mitigation.

Validator: this file class has NO validator. Do not invoke
`validate-contract.sh` on this path — that script validates per-story
sprint-CONTRACT files only and will fail (no contract_schema_version,
no [AC-N] entries here by design).
-->

# Sprint <N> — <goal>

## Goal

<longer-form sprint goal narrative if helpful>

## Committed Tickets

<table or list, links to Jira tickets>

| Ticket | Title | Story Points | Status |
|---|---|---|---|
| PROJ-123 | ... | 5 | In Progress |

## Amendments

<auto-populated by `mk:jira-agile sprint add|remove` post-start; mirrors `amendments:` frontmatter>

## Closure Summary

<filled by `mk:jira-agile sprint close`>

- Delivered: ...
- Carried over: ...

## Notes

<freeform>
