# Standard JIRA Workflow Pattern

> **CONCEPT REFERENCE — NOT AUTHORITATIVE.** This file describes a common workflow shape for orientation. **Your project may use different status names + transitions.** Always consult `tasks/jira-workflows/<workflow-slug>.md` (discovered via `bash the project environment/.agents/skills/jira/scripts/fetch-workflow.sh <KEY>`) for the actual workflow. See `.agents/skills/jira-lifecycle/references/workflow-discovery.md`.

**Use this pattern for:** Basic issue tracking with simple lifecycle.

**Audience:** Teams new to JIRA, small projects, straightforward work tracking.

---

## Workflow Diagram

```
To Do --> In Progress --> Done
  ^          |            |
  |          v            |
  +<-- Stop Progress <----+
             |
             v
          Reopen
```

## Statuses

| Status | Category | Description |
|--------|----------|-------------|
| To Do | To Do (Blue) | Issue created, not started |
| In Progress | In Progress (Yellow) | Active work underway |
| Done | Done (Green) | Work completed |

## Transitions

| From | To | Transition Name |
|------|----|--------------------|
| To Do | In Progress | Start Progress |
| In Progress | Done | Done |
| In Progress | To Do | Stop Progress |
| Done | To Do | Reopen |
| Done | In Progress | Reopen |

## Script Examples

```bash
# Start working on issue
bash the project environment/.agents/skills/jira/scripts/jira-as.sh lifecycle transition PROJ-123 --name "In Progress"

# Complete issue
bash the project environment/.agents/skills/jira/scripts/jira-as.sh lifecycle transition PROJ-123 --name "Done"

# Or with resolution
bash the project environment/.agents/skills/jira/scripts/jira-as.sh lifecycle resolve PROJ-123 --resolution Fixed

# Stop working (return to backlog)
bash the project environment/.agents/skills/jira/scripts/jira-as.sh lifecycle transition PROJ-123 --name "To Do"

# Reopen completed issue
bash the project environment/.agents/skills/jira/scripts/jira-as.sh lifecycle reopen PROJ-123
```

## When to Use

- Simple projects without formal review process
- Quick prototyping or spike work
- Personal task tracking
- Teams just starting with JIRA

## When to Expand

Consider adding more statuses when:
- You need a code review step
- QA/testing is required
- Approval workflows are needed
- Work gets blocked frequently

---

*See [software-dev-workflow.md](software-dev-workflow.md) for a more comprehensive development workflow.*
