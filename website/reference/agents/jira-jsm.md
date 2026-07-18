---
title: jira-jsm
description: Jira Service Management agent — manages service desks, request types, customer requests, queues, SLAs, approvals, and organizations.
---

# jira-jsm

The jira-jsm agent handles Jira Service Management operations — service desks, request types, customer requests, organizations, queues, SLA tracking, and approvals. It requires a JSM-licensed tenant and agent role, operating across 8 sub-domains that cover the full service management lifecycle.

## Cognitive Framing

> *"Service management is customer-facing. SLA awareness and request routing are not optional."*

The jira-jsm agent handles the service management layer that sits on top of core Jira. It manages the customer-facing request lifecycle from intake to resolution, with SLA tracking that ensures response and resolution time commitments are visible and actionable.

## Key Facts

| | |
|---|---|
| **Type** | Domain (Jira) |
| **Phase** | On-demand |
| **Model** | haiku |
| **Color** | blue |
| **Required** | JSM-licensed tenant + agent role |
| **Safety** | Tier 2 (create request), Tier 3 (modify), Tier 4 (delete) |
| **Never does** | Core Jira issue operations (jira-issue), project administration (jira-admin) |

## When to Use

- When you need to **manage service desk requests** — create, view, update.
- When you need to **manage request types** and service desk configuration.
- When you need to **track SLAs** and response time commitments.
- When you need to **manage approvals** for service requests.
- When you need to **manage customers and organizations** in JSM.
- When you need to **monitor queues** and request routing.

## Sub-Domains (8)

| Sub-domain | Description |
|---|---|
| Service desks | List and manage service desk portals |
| Request types | Configure request types and forms |
| Requests | Create, view, and manage customer requests |
| Customers | Manage customer accounts |
| Organizations | Manage customer organizations |
| Queues | Monitor and manage request queues |
| SLAs | Track SLA status and compliance |
| Approvals | Manage request approval workflows |

## Key Capabilities

- **Request management** — creates, views, and manages customer service requests.
- **SLA tracking** — monitors SLA status, response times, and resolution times.
- **Queue management** — lists and monitors request queues for routing.
- **Approval workflows** — manages approval steps for service requests.
- **Customer management** — manages customer accounts and organizations.
- **Service desk configuration** — lists service desks and request types.

## Behavioral Checklist

- [x] Verifies JSM license and agent role before operations
- [x] Tracks SLA status when handling requests
- [x] Manages approval workflows correctly
- [x] Confirms before destructive operations on requests
- [x] Never performs core Jira issue operations — routes to jira-issue
- [x] Never performs project administration — routes to jira-admin

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Create a JSM request" | Creates request via `jsm request create` with appropriate request type |
| "List service desks" | Lists all service desk portals with their keys |
| "SLA status for PROJ-123" | Shows current SLA status, elapsed time, and remaining time |
| "Approve request PROJ-456" | Processes approval via `jsm approval approve` |
| "List queue 'Urgent'" | Shows all requests in the specified queue |

## Pro Tips

### Monitor SLAs Proactively

SLA breaches are visible to customers. Use the jira-jsm agent to check SLA status before breaches occur rather than after. Proactive monitoring prevents the escalation cascade that follows missed SLAs.

### Use Request Types for Routing

Request types determine which queue a request lands in and which SLA applies. Choosing the correct request type at creation time ensures accurate routing and SLA tracking from the start.

## Key Takeaway

The jira-jsm agent manages the customer-facing service management layer with SLA awareness that ensures response and resolution commitments are tracked. By separating JSM operations from core Jira, it provides the specialized tooling that service management workflows require.

## Related Agents

- **[jira-issue](/reference/agents/jira-issue)** — handles core Jira issue CRUD (not JSM-specific)
- **[jira-admin](/reference/agents/jira-admin)** — handles project-level administration (not JSM-specific)
- **[jira-collaborate](/reference/agents/jira-collaborate)** — handles comments on JSM tickets (with internal-vs-public safety)
