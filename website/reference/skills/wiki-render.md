---
title: "mk:wiki-render"
description: "Render a wiki into ONE self-contained HTML snapshot (pages + provenance) that opens offline — no CDN, no remote assets."
---

# mk:wiki-render

## What This Skill Does

Renders a wiki slug into a single self-contained HTML snapshot — every page with its provenance, openable offline.

## When to Use

- **Triggers:** share or review accumulated wiki knowledge as a static page.
- **NOT for:** capturing/approving knowledge ([`mk:wiki`](/reference/skills/wiki)) or generic code/diagram/diff visuals ([`mk:preview`](/reference/skills/preview)).

## Command

```bash
npx mewkit wiki render <slug>              # print HTML to stdout
npx mewkit wiki render <slug> --out <path> # write HTML to a file
```

## Guarantees

- **Self-contained / no CDN** — inline CSS only, zero `http(s)://` asset references, no `<script>`, no `@import`. Opens with no network.
- **DATA-safe** — page content is HTML-escaped before embedding, so wiki content (which is DATA) cannot inject markup or script into the rendered artifact.
- **Provenance shown** — origin, approver, and source ids render as escaped text (never as live links).

## Gotchas

- Render reads the canonical files under `tasks/wikis/<slug>/`; `mewkit wiki reindex` is NOT required (render reads files directly, not the DB).
- A source URL in provenance appears as escaped TEXT, not a clickable `<a href>` — by design (no remote/clickable assets in the offline snapshot).
- Empty wiki → a valid HTML page with "No pages yet."

## Peer Skills

[`mk:wiki`](/reference/skills/wiki) (capture + approve) · [`mk:wiki-research`](/reference/skills/wiki-research) (external fetch → candidate)
