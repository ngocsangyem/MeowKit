---
name: mk:confluence-bulk
description: "Bulk Confluence ops on 10+ pages. NOT for mk:confluence-page."
phase: on-demand
source: local
keywords:
  - confluence-bulk
  - bulk-pages
  - mass-update
  - bulk-delete
  - bulk-label
  - bulk-move
  - dry-run
when_to_use: "Change ten+ pages."
user-invocable: true
context: fork
agent: confluence-bulk
owner: confluence
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["confluence"]
default_enabled: false
---

# mk:confluence-bulk

Forks to the `confluence-bulk` agent. Every bulk command runs with `--dry-run` first; the user approves the `would_*` summary and its count with a plain "yes", then it runs again with `--yes`. A bulk change can touch hundreds of pages, so the agent refuses to skip the dry-run. The full protocol is in `references/dry-run-protocol.md`.

## Triggers

- "bulk update N pages"
- "mass label"
- "delete every page matching CQL"
- "bulk-move pages from SPACE-A to SPACE-B"
- "bulk-label every page in space ENG with 'archive'"

## See also

- Agent: `../../agents/confluence-bulk.md`
- Shared: `../confluence/references/{install-and-auth,cli-idioms,safety-framework}.md` (Tier 4 enforcement lives in safety-framework.md)
- Domain refs:
  - `references/safety-checklist.md` — optional pre-flight checklist; use it when a Higher-Risk Trigger applies
  - `references/dry-run-protocol.md` — the dry-run protocol with an example
- Peer leaves: `mk:confluence-search` (CQL author + read-side overlap; same sanitizer), `mk:confluence-page` (single-page ops), `mk:confluence-collaborate` (comments / attachments at single-page scope)

## Gotchas

- `--max-pages` defaults to 100 and the CLI caps it at 500; a higher value needs the user's explicit OK.
- Bulk ops are not transactional: after a rate-limit or permission failure, re-run on the remainder with `id NOT IN (<completed>)`.
- `bulk delete` moves pages to the trash; restoring is manual in the Confluence UI (there is no restore command).
