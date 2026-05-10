---
name: mk:confluence-search
description: "Confluence CQL search + space list + saved-filter + export via the confluence-as wrapper. Triggers: 'search confluence', 'find pages where X', 'cql for ...', 'export search results', 'list spaces', 'manage saved filters'. CQL injection-safe via the shared sanitizer. NOT for single-page CRUD (mk:confluence-page); NOT for bulk write ops (mk:confluence-bulk)."
phase: on-demand
source: local
keywords: [confluence-search, cql, cql-query, confluence-filter, confluence-export, confluence-space-list]
when_to_use: "Use to find Confluence pages by CQL, validate CQL, build queries from natural language, list spaces, manage saved filters, or export results. NOT for single-page CRUD (use mk:confluence-page)."
user-invocable: true
context: fork
agent: confluence-search
---

# mk:confluence-search

Forks to the `confluence-search` agent. CQL is positional on `search` (and on validate / build helpers); flags everywhere else. The agent enforces CQL sanitization for any user-derived term via `scripts/cql-sanitize.sh`.

## Triggers

- "search confluence for ..."
- "find pages where space = ENG and title ~ 'roadmap'"
- "build a cql for ..."
- "export the search to /tmp/out.csv"
- "list / get / favourite a saved filter"
- "list spaces" / "get space ENG"

## Examples

- "find pages updated in the last 7 days in space ENG, top 20"
- "validate this cql: space = ENG AND title ~ 'Q3'"
- "list every space I can see"
- "save a filter named 'My recent specs' with this cql: ..."

## See also

- Agent: `../../agents/confluence-search.md`
- Shared: `../confluence/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/cql-patterns.md` — canonical CQL templates (curated)
  - `references/cql-reference.md` — full CQL operator + function reference
  - `references/search-examples.md` — practical query examples per scenario
- Peer leaves: `mk:confluence-bulk` (write-side bulk by CQL — same dry-run discipline), `mk:confluence-spec-analyst` (read-only deep analysis), `mk:confluence-page` (single-page CRUD)

## Gotchas

- `confluence-as` does NOT export `_escape_cql_string` — it lives as a private function in the search command module. The `cql-sanitize.sh` shared script is the only safety gate. Use it unconditionally for any user-derived CQL term. [from research]
- The `--quiet` global flag is declared in `confluence-as` but unimplemented (never read in main). Don't rely on it; redirect stderr explicitly when needed. [from research]
- Keychain entry name `"confluence-assistant"` collides with upstream Confluence-Assistant-Skills if both tools are installed. We never use keychain (env-only via wrapper) so we're not affected — but document the collision so users running both know. [from research]
- Two-tier filesystem cache (SkillCache SQLite + `~/.confluence-skills/cache/`) is opaque. Don't depend on cache state — `confluence-as ops cache-clear` is safe to invoke if behavior looks stale. [from research]
- Grow this list as new edge cases surface.
