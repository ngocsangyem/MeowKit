---
name: mk:task-queue
description: "Shared task claiming with file-ownership checks."
source: local
keywords:
  - task-queue
  - ownership-tracking
  - parallel-execution
  - claim-task
  - file-ownership
when_to_use: "Auto-invoked when agents claim work."
user-invocable: false
owner: git
criticality: medium
status: active
runtime: claude-code
---

# Task Queue & Ownership Tracker

An advisory coordination convention for parallel work, not a service: `.meowkit/state/task-queue.json` is a plain file the **lead** (the session that decomposed the work, via `mk:team-config`) creates and edits. Nothing enforces it: no process serializes claims and no hook blocks a write, so it works only when the lead and the agents follow it. For one agent or sequential work you do not need it.

## Task Queue

The lead writes one entry per task. This is the only ownership format in the kit; `mk:team-config` uses it too.

```json
{
  "tasks": [
    {
      "id": 1,
      "description": "Implement API endpoints",
      "owner": null,
      "status": "pending",
      "ownership": ["src/api/*", "src/routes/*"],
      "worktree": null,
      "blocked_by": []
    }
  ]
}
```

`ownership` globs are the files the task may write; `worktree` is set once the lead creates one for it. Status moves `pending` → `in_progress` → `completed`, or `blocked` while a `blocked_by` task is open.

## Assigning

1. The lead picks the lowest-ID task that is `pending` with every `blocked_by` task `completed`.
2. The lead compares its `ownership` globs with those of the `in_progress` tasks. On overlap it restructures or sequences the tasks (see `.claude/skills/cook/references/parallel-execution-rules.md`, Rule 1) instead of assigning.
3. With no overlap, the lead sets `owner` and `status=in_progress`.

Agents ask the lead for work instead of editing the file themselves: that keeps a single writer, which is the only protection against two agents taking the same task.

## Ownership Check

Each agent writes only files that match its task's `ownership`. This is a review step, not enforcement: the lead checks the diff against the globs at integration. An agent that needs a file it does not own stops and reports to the lead.

## Team Coordination

Team-mode rules (commit discipline, completion messages) live in `.claude/skills/team-config/references/team-coordination.md`, loaded by `mk:team-config`.

## Gotchas

- **Overlapping globs:** `src/api/*` and `src/api/auth/*` overlap; keep the more specific path in the same task rather than splitting it across agents.
- **The file is not created for you:** the lead creates it before dispatching. An agent that finds it missing stops and reports, because creating it would make a second writer.
- **Completed tasks stay in the file** as an audit trail until the parallel run ends; the file is recreated per run.
