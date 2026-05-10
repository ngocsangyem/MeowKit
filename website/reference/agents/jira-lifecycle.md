---
title: jira-lifecycle
description: Jira workflow lifecycle agent — drives transitions, assignments, resolution, and version/component management with workflow discovery.
---

# jira-lifecycle

The jira-lifecycle agent drives Jira issues through their workflow — transitioning between statuses, assigning to team members, resolving, reopening, and managing versions and components. Before suggesting any transition, it discovers the actual workflow for the project rather than assuming standard status names.

## Cognitive Framing

> *"Workflows differ per Jira instance. Discover the real workflow before suggesting transitions."*

The jira-lifecycle agent's most important discipline is workflow discovery. Status names and transition graphs vary significantly between Jira instances. Rather than assuming standard names like "To Do → In Progress → Done", the agent discovers the actual workflow for each project and caches it for future use.

## Key Facts

| | |
|---|---|
| **Type** | Domain (Jira) |
| **Phase** | On-demand |
| **Model** | inherit |
| **Color** | yellow |
| **Safety** | Tier 3 (modify), Tier 4 (version/component delete) |
| **Never does** | Issue CRUD (jira-issue), add comments (jira-collaborate), bulk transitions (jira-bulk), assume workflow status names |

## When to Use

- When you need to **transition an issue** to a different status (e.g., "In Progress" → "In Review").
- When you need to **assign or unassign** an issue to a team member.
- When you need to **resolve or reopen** an issue.
- When you need to **manage versions** — create, release, or archive.
- When you need to **manage components** — create, update, or archive.

## Key Capabilities

- **Workflow discovery** — discovers the actual workflow for each project using `fetch-workflow.sh` and caches results. Falls back to per-state discovery on permission restrictions (403).
- **Status transitions** — transitions by name (`--to "In Progress"`) or by ID (`--id 21`), with optional resolution and comment.
- **Assignment management** — assigns, unassigns, and reassigns issues.
- **Version management** — creates, releases, and archives project versions.
- **Component management** — creates and manages project components.
- **Cache validation** — validates cached workflow data against live Jira before execution.

## Behavioral Checklist

- [x] Discovers actual workflow before suggesting transitions — never assumes standard names
- [x] Caches discovered workflows for future use
- [x] Validates cached transitions against live Jira before execution
- [x] Shows diff or runs `--dry-run` for all modify operations (Tier 3)
- [x] Prefers archive over delete for versions and components (Tier 4)
- [x] Never uses educational workflow patterns as authoritative — always prefers discovered cache

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Move PROJ-123 to In Progress" | Discovers workflow, validates transition exists, executes with `--to "In Progress"` |
| "Assign PROJ-123 to john.doe" | Runs assignment via `lifecycle assign` |
| "Mark PROJ-123 as Done" | Transitions with `--to Done --resolution Fixed` |
| "Create version v2.0.0" | Creates project version with `lifecycle version create` |
| "Reopen PROJ-123" | Executes `lifecycle reopen` |

## Pro Tips

### Run Workflow Discovery Early

The first transition request for a new project triggers workflow discovery, which adds latency. Running `fetch-workflow.sh` proactively for your key projects caches the workflows in advance, making subsequent transitions instant.

### Prefer Archive Over Delete

When removing versions or components, the agent always offers archive as the first option. Deleted versions and components cannot be recovered, but archived ones can be restored. Use delete only when archive is explicitly not desired.

## Key Takeaway

The jira-lifecycle agent prevents the most common transition error — using the wrong status name — by discovering the actual workflow before suggesting transitions. This discovery-first approach ensures that operations succeed on the first attempt regardless of how the Jira instance is configured.

## Related Agents

- **[jira-issue](/reference/agents/jira-issue)** — handles issue CRUD; jira-lifecycle handles state changes
- **[jira-bulk](/reference/agents/jira-bulk)** — handles bulk transitions for 10+ issues
- **[jira-collaborate](/reference/agents/jira-collaborate)** — handles comments added during transitions
- **[jira-agile](/reference/agents/jira-agile)** — handles sprint and epic relationships
