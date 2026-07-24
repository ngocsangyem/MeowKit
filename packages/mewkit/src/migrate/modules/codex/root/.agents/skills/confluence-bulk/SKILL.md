---
name: "mk-confluence-bulk"
description: "Bulk Confluence ops (10+ pages): bulk-label/move/delete via confluence-as; dry-run mandatory. NOT single-page (mk:confluence-page) or comments/attachments (mk:confluence-collaborate)."
---

# mk:confluence-bulk

Forks to the `confluence-bulk` agent. The agent enforces a hard 3-step ceremony at runtime — dry-run → confirm → execute.

## Dry-Run Workflow (MANDATORY)

```
Step 1: invocation + --dry-run
Step 2: agent shows would_* JSON keys + impacted-count + first 5 affected page titles
Step 3: explicit user "yes" + typed confirmation token (e.g. "DELETE 47 PAGES")
        → re-invoke without --dry-run
```

Skipping Step 1 is a hard violation. The agent will refuse if asked to skip.

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
  - `references/safety-checklist.md` — pre-flight checklist for any bulk operation
  - `references/dry-run-protocol.md` — the 3-step ceremony in detail with example transcripts
- Peer leaves: `mk:confluence-search` (CQL author + read-side overlap; same sanitizer), `mk:confluence-page` (single-page ops), `mk:confluence-collaborate` (comments / attachments at single-page scope)

## Gotchas

- Default `--max-pages` cap is 100. Higher values require explicit override + extra confirmation. `confluence-as` may impose its own server-side limit (~200 typical).
- `bulk delete` is **soft-delete to trash** — restore requires going through the Confluence UI manually. There is no `--restore-from-trash` op verified in v1.
- Bulk ops are NOT transactional. Partial-failure (rate limit / per-page permission error) leaves the partial-progress count visible; remediation is re-run with `id NOT IN (<completed>)`.
- `bulk restore` is intentionally absent from v1 — confluence-as does not expose it as a single subcommand. v2 may add it via per-page orchestration.
- Grow this list as new edge cases surface.