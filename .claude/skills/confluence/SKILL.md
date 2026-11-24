---
name: mk:confluence
description: "Confluence router to the mk:confluence-* leaf. NOT an executor."
phase: on-demand
source: local
keywords:
  - confluence
  - confluence-router
  - routing-hub
  - atlassian-wiki
  - wiki
  - spec-page
when_to_use: "Confluence leaf unclear."
user-invocable: true
owner: confluence
criticality: medium
status: active
runtime: claude-code
requires_runtime: [python>=3.9]
requires_external_service: ["confluence"]
default_enabled: false
dependency_edges:
  - id: mk:confluence-bulk
    type: peer
  - id: mk:confluence-collaborate
    type: peer
  - id: mk:confluence-page
    type: peer
  - id: mk:confluence-search
    type: peer
  - id: mk:confluence-spec-analyst
    type: peer
  - id: mk:cook
    type: peer
  - id: mk:intake
    type: peer
  - id: mk:jira
    type: peer
  - id: mk:jira-issue
    type: peer
  - id: mk:planning-engine
    type: peer
---

# mk:confluence — Routing Skill

> Script paths in this skill's other files (references, steps) are relative to this skill's directory, `${CLAUDE_SKILL_DIR}`. Prefix them with `${CLAUDE_SKILL_DIR}/` before running them; do not run them from the project root.

This skill only routes: it identifies the right `mk:confluence-*` leaf for the user's Confluence task and points at it.

## Routing Table

| User intent                                                            | Leaf skill                    |
| ---------------------------------------------------------------------- | ----------------------------- |
| Get/create/update/delete a single page or blog post; copy/move/version | `mk:confluence-page`          |
| Search pages with CQL; list spaces; export results                     | `mk:confluence-search`        |
| Deep spec analysis: requirements, gaps, suggested stories              | `mk:confluence-spec-analyst`  |
| Bulk ops on 10+ pages (label, move, delete) — dry-run mandatory        | `mk:confluence-bulk`          |
| Comments, attachments, labels, watchers (collaboration surface)        | `mk:confluence-collaborate`   |

## Disambiguation

- User says skill name verbatim → route immediately
- Numeric token (likely page ID) + verb → match verb to leaf
- Uppercase short token (likely space key) + read intent → `mk:confluence-search`
- CQL syntax (`=`, `AND`, `OR`, `currentUser()`) → `mk:confluence-search`
- 10+ items / `bulk` / `batch` / `mass` keyword → `mk:confluence-bulk`
- Spec analysis intent (`requirements`, `acceptance criteria`, `analyze the spec`) → `mk:confluence-spec-analyst`
- **Labels:** `mk:confluence-collaborate` owns label CRUD (add/remove/list). `mk:confluence-page` does NOT duplicate — if user says "label page X", route to collaborate.
- **Comments / attachments / watchers:** always `mk:confluence-collaborate`, even if scoped to a single page
- Truly ambiguous → ask user one clarifying question

## Setup

One-time install and credentials: `references/install-and-auth.md` (it also carries the guided setup, including the never-echo-the-token rule).

## Shared Resources (used by leaves)

- `scripts/confluence-as.sh` — env-translating wrapper (`MEOW_CONFLUENCE_*` → `CONFLUENCE_*`, sets `CONFLUENCE_OUTPUT=json`, refuses settings.local.json fallback, gates non-Cloud URLs)
- `scripts/cql-sanitize.sh` — CQL injection guard for user-derived input
- `scripts/adf-to-md.sh` + `scripts/adf_to_md.py` — macro-aware ADF→Markdown walker (panel, decisionList/Item, taskList/Item, expand, mention, media, inlineCard preserved with explicit labels)
- `scripts/requirements.txt` — pip dependency manifest read by `mewkit skill env confluence`
- `scripts/smoke-live.sh` — manual live-creds smoke test
- `references/install-and-auth.md` — env vars, setup, Cloud-only gate, escape hatch
- `references/cli-idioms.md` — wrapper invocation patterns + safe-invocation rules + conversion-helper idioms

## Handoff

Spec reports feed `mk:planning-engine` and `mk:intake`; see `mk:confluence-spec-analyst`.

## Gotchas

- This hub never executes; if you are thinking about wrapper commands, forward to a leaf.
- Shared CLI warnings (binary name, lossy ADF, POST retry, `--quiet`) live once in `references/cli-idioms.md`.
- Cloud only: the wrapper exits 3 on a non-`*.atlassian.net` URL. Server/DC users call the Atlassian MCP server directly (`references/install-and-auth.md`); the hub does not fall back to it.
