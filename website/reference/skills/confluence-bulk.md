---
title: "mk:confluence-bulk"
description: "Bulk Confluence operations on 10+ pages via the confluence-as wrapper. Forks the confluence-bulk agent. Dry-run is mandatory."
---

# mk:confluence-bulk

## What This Skill Does

Forks the `confluence-bulk` agent to run bulk operations across many Confluence pages: bulk-label / bulk-move / bulk-delete. The agent enforces a hard 3-step ceremony at runtime — **dry-run → confirm → execute**. Skipping the dry-run step is a hard violation; the agent refuses if asked to skip.

## When to Use

- **Triggers:** "bulk update N pages", "mass label", "delete every page matching CQL", "bulk-move pages from SPACE-A to SPACE-B"
- **NOT for:** single-page ops ([`mk:confluence-page`](/reference/skills/confluence-page)), comment / attachment ops ([`mk:confluence-collaborate`](/reference/skills/confluence-collaborate)).

## Mandatory Dry-Run Protocol

```
Step 1: invocation + --dry-run
Step 2: agent shows would_* JSON keys + impacted-count + first 5 affected page titles
Step 3: explicit user "yes" + typed confirmation token (e.g. "DELETE 47 PAGES")
        → re-invoke without --dry-run, with --yes
```

If the impacted-count differs by >5% between dry-run and execute, the agent surfaces it as a concern in the Status block before proceeding.

## Verified CLI Idioms

| Operation | Tier | Wrapper invocation |
|---|---|---|
| Bulk-label (dry-run) | 4 | `... bulk label add --cql "$SAFE_CQL" --label archive --dry-run` |
| Bulk-move (dry-run) | 4 | `... bulk move --cql "..." --target-parent-id 99999 --dry-run` |
| Bulk-delete (dry-run) | 4 | `... bulk delete --cql "..." --dry-run` |
| Re-invoke (after confirm) | 4 | `... bulk label add --cql "..." --label archive --yes` |

`--max-pages` defaults to 100; raising it requires explicit override + extra confirmation. `confluence-as` may impose its own server-side cap (~200 typical).

## Domain References

- `references/safety-checklist.md` — pre-flight checklist for any bulk operation
- `references/dry-run-protocol.md` — the 3-step ceremony in detail with example transcripts

## Peer Leaves

[`mk:confluence-search`](/reference/skills/confluence-search) (CQL author + read-side overlap; same sanitizer) · [`mk:confluence-page`](/reference/skills/confluence-page) (single-page ops) · [`mk:confluence-collaborate`](/reference/skills/confluence-collaborate) (single-page comments / attachments)

## Agent

[`confluence-bulk`](/reference/agents/confluence-bulk) — A + C (untrusted CQL input + HIGH-blast state change). NOT B (token stays in the wrapper). 2/3 — Rule of Two compliant; the dry-run ceremony is the load-bearing mitigation for blast radius.
