---
name: mk:jira-relationships
description: "mk:jira leaf: issue links, blockers, clone. NOT for mk:jira-collaborate."
phase: on-demand
source: local
keywords:
  - jira
  - jira-relationships
  - jira-link
  - jira-blocker
  - jira-clone
  - jira-dependency
when_to_use: "Link issues or find blockers."
user-invocable: true
context: fork
agent: jira-relationships
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
---

# mk:jira-relationships

Forks to the `jira-relationships` agent. Link direction matters — `A blocks B` ≠ `B blocks A`. The agent confirms direction when ambiguous.

## Triggers

- "link PROJ-123 blocks PROJ-456"
- "what blocks PROJ-123?"
- "what does PROJ-123 depend on?"
- "clone PROJ-123 with new summary 'Follow-up'"
- "unlink PROJ-123 from PROJ-456"

## Examples

- Direct link: "link PROJ-123 as blocked-by PROJ-100"
- Blocker query: "show me everything blocking PROJ-123"
- Bulk-link via JQL: "link all PROJ stories tagged 'epic-x' as part of EPIC-1" (`relationships bulk-link` runs with `--dry-run` first; the user approves the count with a plain "yes", then it runs without it)

## See also

- Agent: `../../agents/jira-relationships.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Before drawing a dependency graph, read `../preview/references/mermaid-essentials.md`
- Domain refs:
  - `references/relationship-patterns.md` — blocker-chain analysis, sprint-planning patterns, dependency strategies
- Peer leaves: `mk:jira-bulk` (the `bulk` group and the shared dry-run rule; `bulk-link` itself is owned here), `mk:jira-agile` (epic-issue is via `agile epic add`, NOT here), `mk:jira-search` (find candidate issues via JQL before linking)
