---
name: mk:confluence-search
description: "Confluence CQL search, export. NOT for mk:confluence-page."
phase: on-demand
source: local
keywords:
  - confluence-search
  - cql
  - cql-query
  - confluence-filter
  - confluence-export
  - confluence-space-list
when_to_use: "Find pages."
user-invocable: true
context: fork
agent: confluence-search
owner: confluence
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["confluence"]
default_enabled: false
---

# mk:confluence-search

Forks to the `confluence-search` agent. CQL is positional: `search cql "<CQL>"`, `search validate "<CQL>"`, `search export "<CQL>" --output <file>`. The agent enforces CQL sanitization for any user-derived term via `../confluence/scripts/cql-sanitize.sh`.

## Triggers

- "search confluence for ..."
- "find pages where space = ENG and title ~ 'roadmap'"
- "export the search to /tmp/out.csv"
- "list spaces" / "get space ENG"

## Examples

- "find pages updated in the last 7 days in space ENG, top 20"
- "validate this cql: space = ENG AND title ~ 'Q3'"
- "list every space I can see"

## See also

- Agent: `../../agents/confluence-search.md`
- Shared: `../confluence/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/cql-patterns.md` — canonical CQL templates (curated)
  - `references/cql-reference.md` — full CQL operator + function reference
  - `references/search-examples.md` — practical query examples per scenario
- Peer leaves: `mk:confluence-bulk` (write-side bulk by CQL — same dry-run discipline), `mk:confluence-spec-analyst` (read-only deep analysis), `mk:confluence-page` (single-page CRUD)

## Gotchas

- Always run user-derived terms through `../confluence/scripts/cql-sanitize.sh`: the CLI does not escape CQL, and an unescaped term can close the quote and add clauses.
