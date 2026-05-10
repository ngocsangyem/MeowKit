---
title: project-manager
description: Delivery tracker agent — produces on-demand status reports by scanning plans, verdicts, contracts, cost logs, and git history.
---

# project-manager

The project-manager is your delivery tracker. When you need to know where a task stands — what is done, what is in progress, what is blocked, and what has not started — the project-manager scans all available artifacts and produces a structured status report. It reads everything but writes only status reports.

## Cognitive Framing

> *"Status comes from artifacts, not assumptions. If there is no evidence, the task is not done."*

The project-manager operates on demand (invoked via `/mk:status`). It reads plan files, review verdicts, sprint contracts, cost logs, and git history to classify every task. It does not track progress in real time — it snapshots the current state when asked.

## Key Facts

| | |
|---|---|
| **Type** | Core |
| **Phase** | On-demand |
| **Auto-activates** | On `/mk:status` invocation |
| **Owns** | `{plan-dir}/status-reports/` |
| **Never does** | Write code, modify plans, change task status in external systems, make delivery promises |

## When to Use

- When you need a **snapshot of task progress** across the current plan.
- When you want to identify **blocked tasks** and understand what is blocking them.
- When preparing a **status update** for stakeholders.
- When you need to understand **how much time and budget** has been spent on the current plan.

## Key Capabilities

- **Evidence-based status classification** — classifies every task as DONE, IN_PROGRESS, BLOCKED, or NOT_STARTED based on artifact evidence (commits, verdicts, test results).
- **Multi-source scanning** — reads plan files, review verdicts, sprint contracts, cost logs, and git history to build a complete picture.
- **Status report generation** — produces structured status reports at `{plan-dir}/status-reports/YYMMDD-status.md`.
- **Blocker identification** — identifies what is blocking each BLOCKED task with specific evidence.
- **Budget tracking** — includes cost data from the analyst's cost logs in status reports.

## Behavioral Checklist

- [x] Classifies tasks using artifact evidence, not assumptions
- [x] Scans all available sources: plans, verdicts, contracts, cost logs, git history
- [x] Produces structured status reports with DONE/IN_PROGRESS/BLOCKED/NOT_STARTED classification
- [x] Identifies blockers with specific evidence for each BLOCKED task
- [x] Includes budget and cost data in status reports
- [x] Never modifies plans or task status in external systems
- [x] Never makes delivery promises based on estimated velocity

## Common Use Cases

| Scenario | What the project-manager does |
|---|---|
| "Where are we on the auth feature?" | Scans plan, verdicts, and git history; produces DONE/IN_PROGRESS/BLOCKED/NOT_STARTED report |
| "What is blocking progress?" | Identifies BLOCKED tasks and traces the blocker to specific artifacts (failed review, missing dependency) |
| "How much have we spent?" | Includes cost data from analyst's cost-log.json in the status report |
| Sprint standup preparation | Produces a comprehensive status snapshot covering all tasks in the current plan |

## Pro Tips

### Use Status Reports to Catch Stalled Tasks

Tasks that remain IN_PROGRESS across multiple status snapshots without artifact changes may indicate silent stalling. The project-manager's evidence-based approach makes this visible — if no commits, verdicts, or test results have changed since the last snapshot, the task is effectively stalled even if it appears active.

### Combine Status with Budget Data

By including cost data in status reports, the project-manager helps you understand not just "where are we?" but also "how much has it cost to get here?" This combination is particularly valuable for identifying tasks that are consuming disproportionate resources relative to their scope.

## Key Takeaway

The project-manager provides clarity on delivery status by relying exclusively on artifact evidence. It never assumes a task is done because someone said so — it checks for commits, passing verdicts, and test results. This evidence-based approach prevents the common failure mode of status reports based on optimistic self-reporting.

## Related Agents

- **[planner](/reference/agents/planner)** — provides plan files that the project-manager reads for task definitions
- **[reviewer](/reference/agents/reviewer)** — provides verdict files that evidence task completion
- **[analyst](/reference/agents/analyst)** — provides cost log data included in status reports
- **[orchestrator](/reference/agents/orchestrator)** — routes to the project-manager on `/mk:status` invocation
