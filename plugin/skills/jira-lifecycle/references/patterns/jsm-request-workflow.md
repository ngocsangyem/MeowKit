# Service Management Request Workflow Pattern

> **CONCEPT REFERENCE — NOT AUTHORITATIVE.** This file describes a common workflow shape for orientation. **Your project may use different status names + transitions.** Always consult `tasks/jira-workflows/<workflow-slug>.md` (discovered via `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/fetch-workflow.sh <KEY>`) for the actual workflow. See `.claude/skills/jira-lifecycle/references/workflow-discovery.md`.

**Use this pattern for:** Customer-facing service requests in JIRA Service Management.

**Prerequisites:** JIRA Service Management license.

**Not for:** Standard JIRA software workflows (see [standard-workflow.md](standard-workflow.md)).

---

## Workflow Diagram

```
Waiting for Support --> In Progress --> Waiting for Customer --> Resolved --> Closed
         |                  |                   |                   |
         +------------------+-------------------+-------------------+--> Cancelled
```

## Statuses

| Status | Category | Description |
|--------|----------|-------------|
| Waiting for Support | To Do (Blue) | Request received, awaiting agent |
| In Progress | In Progress (Yellow) | Agent actively working |
| Waiting for Customer | In Progress (Yellow) | Pending customer response |
| Resolved | Done (Green) | Solution provided |
| Closed | Done (Green) | Request completed |
| Cancelled | Done (Green) | Request cancelled |

## Transitions

| From | To | Transition Name | Notes |
|------|----|--------------------|-------|
| Waiting for Support | In Progress | Start Progress | Agent begins |
| In Progress | Waiting for Customer | Request Feedback | Need info |
| Waiting for Customer | In Progress | Resume | Customer replied |
| In Progress | Resolved | Resolve | Mark resolved |
| Resolved | Closed | Close | Auto or manual |
| Resolved | In Progress | Reopen | Not resolved |
| Any | Cancelled | Cancel | Request cancelled |

## Script Examples

### Standard Request Flow

```bash
# Start working on request
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle transition REQ-123 --name "In Progress"

# Need customer information
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle transition REQ-123 --name "Waiting for Customer" \
  --comment "Please provide your account number for verification"

# Customer responded, resume work
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle transition REQ-123 --name "In Progress"

# Resolve the request
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle resolve REQ-123 --resolution "Done" \
  --comment "Password reset link sent to registered email"

# Close after customer confirms
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle transition REQ-123 --name "Closed"
```

### Cancel Request

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh lifecycle transition REQ-123 --name "Cancelled" \
  --comment "Customer withdrew request"
```

## SLA Considerations

- Respond quickly to stop "Time to First Response" SLA
- Comments while in "Waiting for Customer" pause SLAs
- Set correct priority to trigger appropriate SLA

## Common Resolution Values

| Resolution | When to Use |
|------------|-------------|
| Done | Request completed successfully |
| Won't Do | Request declined |
| Duplicate | Same as another request |
| Cannot Reproduce | Unable to replicate issue |

---

*For incident management, see [incident-workflow.md](incident-workflow.md).*
