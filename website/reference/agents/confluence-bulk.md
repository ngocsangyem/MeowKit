---
title: confluence-bulk
description: Confluence bulk operations agent — bulk-label / bulk-move / bulk-delete across 10+ pages via the confluence-as CLI wrapper. Mandatory dry-run ceremony.
---

# confluence-bulk

The confluence-bulk agent executes bulk operations across many Confluence pages — bulk-label, bulk-move, bulk-delete — through the `confluence-as` CLI wrapper. Every bulk command MUST be invoked with `--dry-run` first; the user reviews the `would_*` JSON keys plus a sample of affected pages; only then is the agent allowed to re-invoke without `--dry-run` after the user types an explicit confirmation token.

## Cognitive Framing

> *"High blast radius. Dry-run first, always. The typed token is the discipline."*

The agent is the highest-blast-radius surface in the Confluence ecosystem. Skipping the dry-run is a hard violation; the agent refuses if asked to skip. The typed-token confirmation forces the user to acknowledge both the operation AND the impacted-count.

## Key Facts

| | |
|---|---|
| **Type** | Domain (Confluence) |
| **Phase** | On-demand |
| **Model** | inherit |
| **Color** | red |
| **Safety** | 3-step ceremony — dry-run → typed-token confirm → execute |
| **Never does** | Single-page ops (confluence-page), comments / attachments / labels at single-page scope (confluence-collaborate), spec analysis (confluence-spec-analyst) |

## When to Use

- When a single CQL match should produce a **bulk label add or remove** across ≥10 pages.
- When you need to **move many pages** to a new parent or space at once.
- When you need to **delete many pages** matching a CQL filter.
- When the user explicitly says "bulk", "mass", "batch", or names ≥10 affected pages.

## Key Capabilities

- **Mandatory 3-step dry-run ceremony** — invocation + `--dry-run` → `would_*` summary + impacted-count + first 5 affected page titles → typed-token confirmation → re-invoke with `--yes`.
- **Drift detection** — if impacted-count differs by >5% between dry-run and execute, the agent surfaces it as a concern in the Status block.
- **CQL sanitization** — all user-derived CQL terms flow through `cql-sanitize.sh`.
- **Bulk-label** — add / remove a label across all matched pages.
- **Bulk-move** — relocate matched pages under a new parent or into a new space.
- **Bulk-delete** — soft-delete to trash (restore via Confluence UI; v1 has no `--restore-from-trash` op).
- **Partial-failure recovery** — bulk ops are NOT transactional; on partial failure, the agent surfaces the completed count and recommends re-running with `id NOT IN (<completed>)`.

## Behavioral Checklist

- [x] Refuses to run a bulk op without `--dry-run` first
- [x] Shows `would_*` JSON keys + impacted-count + first 5 affected titles
- [x] Requires the user to type the confirmation token (e.g. `"DELETE 47 PAGES"`) — bare "yes" is rejected
- [x] Surfaces drift > 5% between dry-run and execute as a Status block concern
- [x] Sanitizes user-derived CQL via `cql-sanitize.sh` unconditionally
- [x] Caps `--max-pages` at 100 by default; raising requires explicit override + extra confirmation
- [x] Documents the soft-delete-to-trash semantics so the user knows restore is a manual UI step

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Label every page in ENG with 'archive'" | Step 1: `bulk label add --cql "space = ENG" --label archive --dry-run`. Step 2: shows count + sample. Step 3: user types "LABEL N PAGES" → re-invoke with `--yes` |
| "Delete every page matching `parent = 99999 AND created < now('-180d')`" | Same 3-step ceremony with `bulk delete` |
| "Move pages from SPACE-A to SPACE-B under parent 12345" | `bulk move --cql "space = SPACE-A" --target-space SPACE-B --target-parent-id 12345 --dry-run` |

## Pro Tips

### Soft-Delete Means UI-Only Restore

`bulk delete` moves pages to trash — restore requires the Confluence UI. There is no `--restore-from-trash` op verified in v1. Communicate this to the user before they confirm a `bulk delete`.

### Partial Failure Is Common at Scale

Bulk ops are NOT transactional. A rate-limit hit or per-page permission error mid-run leaves partial progress visible. The remediation is straightforward: re-run with `id NOT IN (<completed-ids>)`, but the agent surfaces the situation explicitly rather than retrying silently.

### Match `--max-pages` to Reality

The default cap of 100 catches the most common bulk-op shape. Anything over 200 should make the user pause — the upstream `confluence-as` may impose its own server-side limit there. If `--max-pages 500` is requested, the agent demands an additional confirmation that the user understands the cap.

## Key Takeaway

The confluence-bulk agent is the only sanctioned path to operations that touch ≥10 pages at once. The 3-step dry-run ceremony is non-negotiable; the typed-token confirmation forces deliberate acknowledgment of both the operation AND the count.

## Related Agents

- **[confluence-search](/reference/agents/confluence-search)** — author + validate the CQL before invoking the bulk op
- **[confluence-page](/reference/agents/confluence-page)** — for single-page ops below the bulk threshold
- **[confluence-collaborate](/reference/agents/confluence-collaborate)** — for single-page comments / attachments / labels (NOT bulk)
