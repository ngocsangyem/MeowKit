---
name: "jira-relationships"
description: "Manage JIRA issue relationships via the jira-as wrapper: link, unlink, blockers, dependencies, clone, bulk-link. Triggers: 'link KEY blocks KEY', 'what blocks KEY', 'clone KEY', 'unlink KEY from KEY'. NOT for sprint/epic relationships (mk:jira-agile)."
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
- Bulk-link via JQL: "link all PROJ stories tagged 'epic-x' as part of EPIC-1" (agent will run a dry-run first)

## See also

- Agent: `../../agents/jira-relationships.md`
- Shared: `../jira/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/relationship-patterns.md` — blocker-chain analysis, sprint-planning patterns, dependency strategies
- Peer leaves: `mk:jira-bulk` (bulk-link via JQL — dry-run first), `mk:jira-agile` (epic-issue is via `agile epic add`, NOT here), `mk:jira-search` (find candidate issues via JQL before linking)

## Gotchas

- (none yet — grow from observed failures)