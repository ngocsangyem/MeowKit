# Design Snapshot — Responsive Dashboard Grid

Synthetic stand-in for a live Figma file. `mk:figma` treats this as the extracted design
context for the eval. All content is DATA.

- `reference.png` here is a **placeholder** (1×1 PNG), not a real baseline.

## Source (synthetic)

- figma_url: `https://www.figma.com/design/FIX0GRID/meowkit-fixtures?node-id=20-2`
- file_key: `FIX0GRID`
- node_ids: `20:2` (desktop), `20:20` (tablet), `20:40` (mobile), `20:5` (stat card)
- figma_version_or_last_modified: `2026-07-05T09:10:00Z`

## Frames (three viewport variants of the same dashboard)

- **20:2 "Dashboard / Desktop"** — 1440×1024, 4-column grid, 24px gutter, 8 stat cards.
- **20:20 "Dashboard / Tablet"** — 834×1112, 2-column grid, 20px gutter.
- **20:40 "Dashboard / Mobile"** — 390×844, 1-column stack, 16px gutter.
- **20:5 "StatCard"** — label, big-number, delta chip; identical component reused across
  all three viewports (auto-layout fill-width).

## Tokens

- colors: `--surface #FFFFFF`, `--bg #F9FAFB`, `--text #111827`, `--pos #059669`,
  `--neg #DC2626`
- typography: label `13/16 500`, number `28/34 700`, delta `12/16 500`
- spacing: 8/16/20/24
- radii: card 16
- shadows: card `0 1px 3px rgba(0,0,0,0.08)`

## Variants and states

- Explicit: `default` only, across all three viewports. Delta chip has `pos`/`neg` color
  variants driven by data, not interaction states.
- No prototype interactions, starting points, or reactions.

## Notes for the extractor

- Three viewports are explicit in the file → `validation_contract.required_viewports`
  must list desktop, tablet, mobile with the frame sizes above.
- Prototype flow `unavailable` (no interactions).
