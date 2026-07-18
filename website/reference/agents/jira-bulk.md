---
title: jira-bulk
description: Jira bulk operations agent — handles transition, assign, priority, clone, and delete operations on 10+ issues with mandatory dry-run.
---

# jira-bulk

The jira-bulk agent performs operations across 10 or more Jira issues simultaneously — bulk transitions, assignments, priority changes, cloning, and deletion. Every bulk operation requires a mandatory dry-run first, showing exactly what will change before any modification is executed.

## Cognitive Framing

> *"Dry-run is not optional. With 10+ issues at stake, you preview every change before executing."*

The jira-bulk agent handles high-volume operations that would be impractical one-at-a-time. Its most important safety discipline is mandatory dry-run — before any bulk operation executes, it previews the full list of affected issues and proposed changes, giving the user a chance to review and confirm.

## Key Facts

| | |
|---|---|
| **Type** | Domain (Jira) |
| **Phase** | On-demand |
| **Model** | haiku |
| **Color** | red |
| **Safety** | Mandatory dry-run for all operations. Tier 3 (modify), Tier 4 (delete) |
| **Never does** | Single-issue operations (jira-issue), skip dry-run, execute without user confirmation |

## When to Use

- When you need to **transition 10+ issues** to a new status simultaneously.
- When you need to **bulk-assign** issues to a team member.
- When you need to **change priority** on multiple issues at once.
- When you need to **bulk-clone** issues (e.g., creating tasks from a template).
- When you need to **bulk-delete** issues (highest risk, most confirmation required).

## Key Capabilities

- **Bulk transition** — transitions multiple issues to a target status in a single operation.
- **Bulk assignment** — assigns or reassigns multiple issues to a team member.
- **Bulk priority** — changes priority on multiple issues simultaneously.
- **Bulk clone** — creates copies of multiple issues with a shared pattern.
- **Bulk delete** — deletes multiple issues (highest safety tier, maximum confirmation required).
- **Mandatory dry-run** — every operation previews affected issues and proposed changes before execution.

## Behavioral Checklist

- [x] Runs dry-run before every bulk operation — mandatory, never skipped
- [x] Shows the full list of affected issues with proposed changes during dry-run
- [x] Waits for explicit user confirmation before executing
- [x] Reports results with success/failure counts after execution
- [x] Applies highest confirmation requirements for bulk delete operations
- [x] Never performs single-issue operations — routes those to jira-issue

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Move all QA-ready tickets to Done" | Dry-runs the transition showing all affected issues, waits for confirmation, executes |
| "Assign all unassigned bugs to john.doe" | Shows list of affected bugs in dry-run, confirms, then bulk-assigns |
| "Set all tech debt tickets to Low priority" | Previews priority changes in dry-run, executes after confirmation |
| "Clone these 15 sprint planning templates" | Dry-runs the clone operation, confirms, creates 15 new issues |
| "Delete all test issues in PROJ" | Highest safety: dry-run, explicit confirmation, then deletes |

## Pro Tips

### Always Review the Dry-Run Output

The dry-run output is your safety net. A bulk transition on 50 issues that accidentally includes the wrong JQL filter can cause significant disruption. Take 30 seconds to review the affected issue list before confirming — it prevents hours of manual cleanup.

### Use Bulk Operations for Sprint Cleanup

At sprint end, bulk transitions are the fastest way to move incomplete issues back to the backlog or close completed ones. Combined with jira-search JQL queries, you can precisely target the issues that need to move.

## Key Takeaway

The jira-bulk agent makes high-volume Jira operations safe through mandatory dry-run previews. By showing exactly what will change before executing, it prevents the cascade failures that make bulk operations risky in other tools.

## Related Agents

- **[jira-issue](/reference/agents/jira-issue)** — handles single-issue operations (< 10 issues)
- **[jira-search](/reference/agents/jira-search)** — provides JQL queries that define the bulk operation scope
- **[jira-lifecycle](/reference/agents/jira-lifecycle)** — handles single-issue transitions
