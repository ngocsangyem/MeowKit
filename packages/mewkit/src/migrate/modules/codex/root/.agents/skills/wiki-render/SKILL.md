---
name: "wiki-render"
description: "Render a wiki into ONE self-contained HTML snapshot (pages + provenance) that opens offline — no CDN, no remote assets, page content HTML-escaped. Use to share or review accumulated wiki knowledge as a static page. NOT for capturing/approving knowledge (see mk:wiki); NOT for generic code/diagram visuals (see mk:preview)."
---

# mk:wiki-render

A single self-contained HTML snapshot of a wiki — every page with its provenance, openable offline.

## Command

```
npx mewkit wiki render <slug>              # print HTML to stdout
npx mewkit wiki render <slug> --out <path> # write HTML to a file
```

## Guarantees

- **Self-contained / no CDN** — inline CSS only, zero `http(s)://` asset references, no `<script>`, no `@import`. Opens with no network.
- **DATA-safe** — page content is HTML-escaped before embedding, so wiki content (which is DATA) cannot inject markup or script into the rendered artifact.
- **Provenance shown** — origin, approver, and source ids render as escaped text (never as live links).

## Gotchas

- Render reads the canonical files under `tasks/wikis/<slug>/`; run `mewkit wiki reindex` is NOT required for render (render reads files directly, not the DB).
- A source URL in provenance appears as escaped TEXT, not a clickable `<a href>` — by design (no remote/clickable assets in the offline snapshot).
- Empty wiki → a valid HTML page with "No pages yet."