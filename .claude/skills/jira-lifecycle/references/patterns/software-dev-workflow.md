# Software Development Workflow Pattern

> **CONCEPT REFERENCE — NOT AUTHORITATIVE.** This file describes a common workflow shape for orientation. **Your project may use different status names + transitions.** Always consult `tasks/jira-workflows/<workflow-slug>.md` (discovered via `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/fetch-workflow.sh <KEY>`) for the actual workflow. See `meowkit/.claude/skills/jira-lifecycle/references/workflow-discovery.md`.

**Use this pattern for:** Development teams with code review and QA processes.

**Audience:** Engineering teams, DevOps, software development projects.

---

## Workflow Diagram

```
Backlog --> To Do --> In Progress --> In Review --> In QA --> Done
   |          |            |              |           |        |
   |          |            v              v           v        |
   +----------+--------> Rejected/Won't Do <------------------+
```

## Statuses

| Status | Category | Description |
|--------|----------|-------------|
| Backlog | To Do (Blue) | Prioritized work queue |
| To Do | To Do (Blue) | Ready for current sprint |
| In Progress | In Progress (Yellow) | Developer working on it |
| In Review | In Progress (Yellow) | Awaiting code review |
| In QA | In Progress (Yellow) | Quality assurance testing |
| Done | Done (Green) | Completed and deployed |
| Rejected | Done (Green) | Decided not to implement |

## Transitions

| From | To | Transition Name | Notes |
|------|----|--------------------|-------|
| Backlog | To Do | Select for Sprint | Sprint planning |
| To Do | In Progress | Start Progress | Dev begins work |
| In Progress | In Review | Submit for Review | PR created |
| In Review | In Progress | Request Changes | Reviewer feedback |
| In Review | In QA | Approve | Code approved |
| In QA | In Progress | Reject | QA found issues |
| In QA | Done | Pass QA | Ready for release |
| Any | Rejected | Reject | Won't implement |

## Script Examples

### Development Flow

```bash
# Pick up work from sprint
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle transition PROJ-123 --name "In Progress"
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle assign PROJ-123 --self

# Submit for review
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle transition PROJ-123 --name "In Review" \
  --comment "PR: https://github.com/org/repo/pull/456"

# After approval, move to QA
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle transition PROJ-123 --name "In QA"
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle assign PROJ-123 --user qa-lead@example.com

# Complete
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle resolve PROJ-123 --resolution "Fixed"
```

### Handling Rejections

```bash
# Code review needs changes
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle transition PROJ-123 --name "In Progress" \
  --comment "Addressing review feedback"

# QA found bug
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle transition PROJ-123 --name "In Progress" \
  --comment "Fixing: Null pointer on edge case"
```

## Recommended Conditions

| Transition | Suggested Condition |
|------------|---------------------|
| Start Progress | Issue must have estimate |
| Submit for Review | Assignee must be current user |
| Approve | User must be in Developers group |
| Pass QA | User must be in QA group |

## Recommended Post-Functions

| Transition | Post-Function |
|------------|---------------|
| Submit for Review | Notify tech lead |
| Pass QA | Update fix version |
| Complete | Clear assignee (optional) |

---

*For simpler workflows, see [standard-workflow.md](standard-workflow.md).*
