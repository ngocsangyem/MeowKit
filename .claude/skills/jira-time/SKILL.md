---
name: mk:jira-time
description: 'mk:jira leaf. Log work, list or edit worklogs, estimates, time reports. NOT for mk:jira-agile.'
phase: on-demand
source: local
keywords:
  - jira
  - jira-time
  - jira-worklog
  - jira-estimate
  - time-tracking
  - jira-report
when_to_use: 'Log hours against a Jira ticket or pull a worklog time report.'
user-invocable: true
context: fork
agent: jira-time
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
---

# mk:jira-time

Forks to the `jira-time` agent. Duration format: `30m`, `2h`, `1d 4h`. The agent confirms before any worklog `update` / `delete` — those are effectively irreversible.

## Triggers

- "log 2h on PROJ-123 with comment 'paired with x'"
- "show worklogs for PROJ-123"
- "set original estimate 1d, remaining 4h on PROJ-123"
- "time report for project PROJ from 2026-04-01 to 2026-04-30"
- "bulk-log 30m to all my open PROJ tickets" (dry-run first)

## Examples

- Single log: "log 30m on PROJ-456 — code review"
- Estimate: "set original estimate 8h on PROJ-789"
- Report: "export the April time report for PROJ to /tmp/april.csv"

## See also

- Agent: `../../agents/jira-time.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/time-tracking.md` — wrapper-flow patterns
  - `references/time-format-quick-ref.md` — duration syntax (15m, 2h, 1d 4h, 1w)
  - `references/jql-snippets.md` — copy-paste time-related JQL (worklog by user/date)
  - `references/estimation-guide.md` — story-point vs time estimation tradeoffs
- Peer leaves: `mk:jira-search` (JQL for worklog filters), `mk:jira-agile` (sprint capacity uses time data), `mk:jira-bulk` (bulk-log)

## Gotchas

- (none yet — grow from observed failures)
