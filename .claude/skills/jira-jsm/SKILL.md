---
name: mk:jira-jsm
description: "mk:jira leaf: Service Management, SLAs. NOT for mk:jira-admin."
phase: on-demand
source: local
keywords:
  - jira
  - jira-jsm
  - service-management
  - service-desk
  - sla
  - jira-customer
  - jira-queue
  - jira-approval
when_to_use: "A JSM request."
user-invocable: true
context: fork
agent: jira-jsm
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
---

# mk:jira-jsm

Forks to the `jira-jsm` agent. Service Management (JSM) operations — service desks, requests, SLAs, customers, organizations, queues, approvals, request types.

## Triggers

- "create JSM request in service desk 'IT Support'"
- "list service desks"
- "SLA status for KEY-123"
- "approve request KEY-123"
- "list queue 'Tier 1 Support'"
- "add comment to JSM request KEY-123" (agent confirms visibility)

## Examples

- Get service desk status: "show me the queues for service desk 'IT Support'"
- Customer-facing comment: "add public comment to KEY-123: '<message>'" → agent confirms visibility first; the rule is owned by `mk:jira-collaborate`.

## Required Permissions

JSM-licensed tenant + agent or admin role. Insufficient permission → exit code 3.

## Limitations

- 9 sub-domains (`service-desk`, `request-type`, `request`, `customer`, `organization`, `queue`, `sla`, `approval`, `kb`) — see `jira-as jsm <sub-domain> --help` for the authoritative flag list.
- A customer-facing comment is visible to the requester: use `jsm request comment ... --internal` for agent-only notes; the visibility rule lives in `mk:jira-collaborate`.

## See also

- Agent: `../../agents/jira-jsm.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/decision-tree.md` — JSM vs core-Jira leaf, one table
  - `references/itil-workflows.md` — read only for incident, service-request, problem or change process questions
- Peer leaves: `mk:jira-collaborate` (owns the internal-vs-public rule), `mk:jira-lifecycle` (`patterns/jsm-request-workflow.md`), `mk:jira-admin` (request-type / queue config)

## Gotchas

- (none yet)
