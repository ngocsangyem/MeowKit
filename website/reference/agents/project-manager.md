---
title: project-manager
description: Cross-workflow delivery tracker — aggregates plan, test, review, contract, and cost state into evidence-based status reports.
---

# project-manager

Tracks delivery across workflows and produces evidence-based status reports. Backward-looking ("what's done", "what's blocked") — for forward-looking navigation use `mk:help`. Reads only from canonical sources; writes status reports co-located inside each plan directory.

## Key facts

| | |
|---|---|
| **Type** | Core |
| **Phase** | on-demand (0–6) |
| **Auto-activates** | `/mk:status` invocation only |
| **Owns** | `{plan-dir}/status-reports/*-status.md` |
| **Never does** | Write code, modify plans, edit verdicts, invent numbers |

## State aggregation

Aggregates from canonical sources only:

- `{plan-dir}/plan.md` + phase files — planned scope
- `tasks/reviews/*-verdict.md` + `*-evalverdict.md` — gate state
- `tasks/contracts/*.md` — harness contracts
- `.claude/memory/cost-log.json` — filtered by session_id
- `git log --since=ANCHOR` — landed commits

## Task classification

| Status | Condition |
|---|---|
| DONE | Criteria met + tests pass + commit landed |
| IN_PROGRESS | Code written, review pending |
| BLOCKED | >1 session stalled, gate-failed, or awaiting decision |
| NOT_STARTED | No code written |

## Report output

Writes to `{plan-dir}/status-reports/{YYMMDD}-status.md`. Overwrites on same-day rerun (idempotent). Uses template at `tasks/templates/pm-status-template.md`.

## Opt-out

`MEOWKIT_PM_AUTO=off` disables silent background fires from orchestration skills. User-invoked `/mk:status` is always honored.
