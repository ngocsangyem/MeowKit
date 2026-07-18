---
title: confluence-search
description: Confluence search agent — runs CQL queries, validates CQL, lists spaces, manages saved filters, and exports results via the confluence-as CLI wrapper.
---

# confluence-search

The confluence-search agent finds Confluence pages by criteria. It runs CQL queries, validates CQL syntax, builds queries from natural language, lists spaces, manages saved filters, and exports results — every user-derived term flowing through the `cql-sanitize.sh` injection guard before reaching the wrapper.

## Cognitive Framing

> *"Search is read-only — sanitize once, query confidently."*

The confluence-search agent is a domain-specific agent for query authorship + read-only search execution. The only state-changing surface is saved-filter management (create / update / delete a saved filter), which the agent treats as Tier 2 / 3.

## Key Facts

| | |
|---|---|
| **Type** | Domain (Confluence) |
| **Phase** | On-demand |
| **Model** | haiku |
| **Color** | green |
| **Safety** | Mandatory CQL sanitization for any user-derived term |
| **Never does** | Single-page CRUD (confluence-page), bulk write ops (confluence-bulk) |

## When to Use

- When you need to **find pages** by space, title, label, owner, dates, or full-text terms.
- When you need to **validate CQL syntax** before running a destructive bulk op.
- When you need to **build a CQL query from natural language** ("pages updated in the last 7 days in ENG").
- When you need to **list spaces** the user has access to or **inspect a single space**.
- When you need to **save / favourite / list / delete saved filters**.
- When you need to **export search results** to CSV / JSON / Markdown.

## Key Capabilities

- **CQL search** — positional CQL on `search`, `validate`, `build` (NOT a flag).
- **Mandatory sanitization** — all user-derived terms pass through `scripts/cql-sanitize.sh` before reaching the wrapper.
- **Space listing** — `space list` and `space get` for discovery.
- **Saved-filter management** — list / favourite / save / delete personal filters.
- **Export** — `--export csv` / `json` / `markdown` with `--output <path>`.
- **Cursor pagination** — handles paging internally; `--limit` raises the per-page cap.

## Behavioral Checklist

- [x] Sanitizes every user-derived CQL term via `cql-sanitize.sh` — unconditional, no trusted-input path
- [x] Quotes CQL templates correctly (sanitizer escapes `\` and `"` only — caller is responsible for placing the value inside quotes)
- [x] Runs `validate "<cql>"` before any large search to catch syntax errors early
- [x] Projects output for readability — id, title, space, lastModified
- [x] Captures common CQL patterns in memory (per project / team) for future sessions
- [x] Never depends on cache state — `ops cache-clear` is a safe escape hatch

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Find pages updated in the last 7 days in ENG" | Builds CQL `space = ENG AND lastmodified > now("-7d")`, runs `search` |
| "Validate this CQL: space = ENG AND title ~ 'Q3'" | Runs `validate "space = ENG AND title ~ \"Q3\""` and surfaces parse errors |
| "List every space I can see" | `space list --limit 50` |
| "Save a filter for my recent specs" | `filter save --name "..." --cql "..."` |
| "Export the search results as CSV" | Re-runs the prior search with `--export csv --output /tmp/out.csv` |

## Pro Tips

### CQL Is Positional, Not a Flag

`confluence-as search "<cql>"` takes the query string as the first positional argument. Don't try `--cql "<cql>"` — it won't be recognized. The same applies to `validate` and `build`.

### Keychain Collision Awareness

The `confluence-as` upstream uses keychain entry name `"confluence-assistant"`, which collides with the upstream `Confluence-Assistant-Skills` package if both are installed. MeowKit always goes through the env-only wrapper — but if both tools are installed in the same environment, document the collision so users don't get surprised.

## Key Takeaway

The confluence-search agent is the read-side gateway for finding pages by criteria. Sanitize once at the boundary, then query freely — the only state change is saved-filter management.

## Related Agents

- **[confluence-page](/reference/agents/confluence-page)** — single-page CRUD after a search narrows the target
- **[confluence-bulk](/reference/agents/confluence-bulk)** — write-side bulk by CQL (same sanitizer; mandatory dry-run)
- **[confluence-spec-analyst](/reference/agents/confluence-spec-analyst)** — read-only deep analysis after a search identifies a target spec
