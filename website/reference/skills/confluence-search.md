---
title: "mk:confluence-search"
description: "Confluence CQL search + space list + saved-filter + export via the confluence-as wrapper. Forks the confluence-search agent."
---

# mk:confluence-search

## What This Skill Does

Forks the `confluence-search` agent to run CQL queries, validate CQL, build queries from natural language, list spaces, manage saved filters, and export results. Every user-derived CQL term flows through the shared `cql-sanitize.sh` guard before reaching the wrapper.

## When to Use

- **Triggers:** "search confluence", "find pages where space = ENG and title ~ 'roadmap'", "build a cql for ...", "export the search to /tmp/out.csv", "list spaces"
- **NOT for:** single-page CRUD ([`mk:confluence-page`](/reference/skills/confluence-page)), bulk write ops ([`mk:confluence-bulk`](/reference/skills/confluence-bulk)).

## Verified CLI Idioms

| Operation | Tier | Wrapper invocation |
|---|---|---|
| Search (positional CQL) | 1 | `bash $CLAUDE_PROJECT_DIR/.claude/skills/confluence/scripts/confluence-as.sh search "space = ENG AND title ~ \"roadmap\""` |
| Sanitize before search | 1 | `SAFE=$(bash $CLAUDE_PROJECT_DIR/.claude/skills/confluence/scripts/cql-sanitize.sh "$USER_TERM")` |
| Validate | 1 | `... validate "space = ENG"` |
| List spaces | 1 | `... space list --limit 50` |
| Get space | 1 | `... space get --space-key ENG` |
| Saved filter — list / favourite | 1 | `... filter list` / `... filter favourite --filter-id <id>` |
| Saved filter — save | 2 | `... filter save --name "..." --cql "..."` |
| Export | 1 | `... search "..." --export csv --output /tmp/out.csv` |

CQL is **positional** on `search` / `validate` / `build` (NOT a flag). Run `--help` per verb for the authoritative surface.

## Domain References

- `references/cql-patterns.md` — canonical CQL templates (curated)
- `references/cql-reference.md` — full CQL operator + function reference
- `references/search-examples.md` — practical query examples per scenario

## Peer Leaves

[`mk:confluence-bulk`](/reference/skills/confluence-bulk) (write-side bulk by CQL — same sanitizer) · [`mk:confluence-spec-analyst`](/reference/skills/confluence-spec-analyst) (read-only deep analysis) · [`mk:confluence-page`](/reference/skills/confluence-page) (single-page CRUD)

## Agent

[`confluence-search`](/reference/agents/confluence-search) — A only (untrusted CQL input). NOT B (no sensitive data), NOT C (read-only at Confluence side; saved-filter writes are the only state change). 1/3 read, 2/3 write — Rule of Two compliant.
