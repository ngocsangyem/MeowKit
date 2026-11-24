# ITIL Workflows on JSM

Read this only for incident, service-request, problem or change process questions. Every command goes through `bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh` (shown as `jira-as` below); confirm any flag with `jira-as jsm <sub-domain> <verb> --help`.

| Process | Request type | Verbs used |
|---------|--------------|------------|
| Incident | Incident | `request create`, `sla get`, `sla check-breach`, `request transition` |
| Service request | Service Request | `request create`, `approval list`, `approval approve` |
| Problem | Problem | `request create`, `request comment`, `request transition` |
| Change | Change | `approval pending`, `approval approve`, `approval decline` |

## Incident

```bash
jira-as jsm request create <service-desk-id> <request-type-id> --summary "VPN down" --description "..." --priority High --dry-run
jira-as jsm request comment SD-125 "Investigating" --internal
jira-as jsm sla get SD-125
jira-as jsm sla check-breach SD-125
jira-as jsm kb suggest SD-125
jira-as jsm request transition SD-125 --to Resolved --comment "Fixed"
```

Run `request create` with `--dry-run` first, then without it. Use `--internal` for notes the customer must not see; leave it off only when the user asked for a customer-facing reply.

## Service request with approval

```bash
jira-as jsm approval list SD-130
jira-as jsm approval approve SD-130 --approval-id <id> --dry-run
jira-as jsm request add-participant SD-130 --account-id <accountId>
jira-as jsm request transition SD-130 --to Completed
```

## Problem

Link the incidents with `mk:jira-relationships`, then record the root cause with `jsm request comment SD-145 "..." --internal` and close with `request transition --to Closed`.

## Change

```bash
jira-as jsm approval pending --service-desk-id 1
jira-as jsm approval approve SD-140 --approval-id <id>
jira-as jsm approval decline SD-140 --approval-id <id> --dry-run
jira-as jsm request transition SD-140 --to "In Progress"
```

Approve and decline act on someone's behalf: show the request and the approval id, and get the user's "yes" first.

## SLA reporting and knowledge base

```bash
jira-as jsm sla report --service-desk 1 --breached-only
jira-as jsm kb search --service-desk 1 --query "VPN setup"
jira-as jsm kb suggest SD-123
```
