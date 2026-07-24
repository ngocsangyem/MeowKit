---
name: "mk-confluence-page"
description: "Confluence page CRUD via confluence-as: create/show/update/delete, hierarchy, copy. NOT bulk (mk:confluence-bulk), spec analysis (mk:confluence-spec-analyst), or comments (mk:confluence-collaborate)."
---

# mk:confluence-page

Forks to the `confluence-page` agent (system prompt at `.codex/agents/confluence-page.md`). The skill body is the task brief — the host runtime injects this content into the forked agent.

## Triggers

- "create a page in SPACE titled '...'"
- "show me / get / view page 12345"
- "update title / body of page 12345"
- "delete page 12345"
- "list children / ancestors / descendants of page 12345"
- "copy / move page 12345 to SPACE"

## Examples

- Quick create: "create a page in ENG titled 'Q3 Roadmap' with body from /tmp/draft.md"
- Templated create: "create an RFC page in ENG from the rfc template"
- Read with projection: "show me page 12345 in storage format"
- Update: "set title to 'Q3 Roadmap (final)' on page 12345"
- Hierarchy: "list children of page 12345 with depth 2"

## See also

- Agent: `../../agents/confluence-page.md`
- Shared: `../confluence/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/page-templates.md` — RFC / Runbook / Decision Record skeletons
  - `references/field-formats.md` — storage / view / export_view / ADF distinctions
  - `references/version-restore-guide.md` — version operations + restore semantics
- Peer leaves: `mk:confluence-search` (CQL search + space list), `mk:confluence-collaborate` (comments / attachments / labels), `mk:confluence-bulk` (10+ pages), `mk:confluence-spec-analyst` (spec analysis)

## Gotchas

- Wrapper output is JSON only after the stdout filter runs. Do not parse raw `confluence-as` output — always go through the wrapper. [from research]
- POST is in `confluence-as` retry `allowed_methods`. Create ops on flaky networks may produce duplicate pages. Before retrying a failed `page create`, list pages with the same title in the target space first. [from research]
- ADF round-trip is **lossy** on `panel`, `expand`, `mention`, `emoji`, `media`, `decision`, `task-list` nodes. Re-saving a page with these macros via update may flatten them. See `references/field-formats.md` Round-Trip Caveats. [from research]
- XHTML parsing in `confluence-as` is regex-based. Malformed or deeply nested storage format may fail silently. Prefer markdown via `--content` for fresh page bodies. [from research]
- `version restore` creates a NEW version on top of head — it is not in-place rollback. See `references/version-restore-guide.md`. [from research]
- Grow this list as new edge cases surface.