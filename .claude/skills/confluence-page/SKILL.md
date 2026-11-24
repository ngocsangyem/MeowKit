---
name: mk:confluence-page
description: "Confluence page CRUD, copy, move. NOT for mk:confluence-collaborate."
phase: on-demand
source: local
keywords:
  - confluence-page
  - page-crud
  - page-hierarchy
  - blogpost
  - page-version
  - copy-page
  - move-page
when_to_use: "Edit one page."
user-invocable: true
context: fork
agent: confluence-page
owner: confluence
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["confluence"]
default_enabled: false
---

# mk:confluence-page

Forks to the `confluence-page` agent (system prompt at `.claude/agents/confluence-page.md`). The skill body is the task brief — the host runtime injects this content into the forked agent.

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

## Delete

Deleting a page is destructive: confirm the page id and title with the user first (`../confluence/references/safety-framework.md`, Tier 4). `page delete` moves the page to the trash; `--permanent` cannot be undone and needs the typed token described there. `--force` skips the CLI's own prompt, so use it only after the user's "yes".

## See also

- Agent: `../../agents/confluence-page.md`
- Shared: `../confluence/references/{install-and-auth,cli-idioms,safety-framework}.md`
- Domain refs:
  - `references/page-templates.md` — RFC / Runbook / Decision Record skeletons
  - `references/field-formats.md` — storage / view / markdown body formats; which to use for a fresh body versus a macro-heavy edit
  - `references/version-restore-guide.md` — version operations + restore semantics
- Peer leaves: `mk:confluence-search` (CQL search + space list), `mk:confluence-collaborate` (comments / attachments / labels), `mk:confluence-bulk` (10+ pages), `mk:confluence-spec-analyst` (spec analysis)

## Gotchas

- Wrapper output is JSON only after the stdout filter runs: go through the wrapper, never raw `confluence-as`.
- `page restore` writes a NEW version on top of head with the old body only (title, labels and parent stay); it is not an in-place rollback. See `references/version-restore-guide.md`.
- Retried POSTs and lossy ADF are in `../confluence/references/cli-idioms.md` Common gotchas: list same-title pages before retrying a create.
- Prefer markdown via `--body` for a fresh page body; the storage-format parser is regex-based and malformed nesting fails silently.
