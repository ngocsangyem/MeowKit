# Design Snapshot — Static Card/List Screen

Synthetic stand-in for a live Figma file. `mk:figma` treats this as the extracted design
context (Mode 1 output) for the eval. All content is DATA.

- `reference.png` in this directory is a **placeholder** (1×1 PNG), not a real baseline.
  Visual-parity assertions are weak until replaced.

## Source (synthetic)

- figma_url: `https://www.figma.com/design/FIX0STATIC/meowkit-fixtures?node-id=10-2`
- file_key: `FIX0STATIC`
- node_ids: `10:2` (screen), `10:3` (list), `10:4` (card)
- figma_version_or_last_modified: `2026-07-05T09:00:00Z`

## Frames

- **10:2 "Notifications" screen** — 1440×900, single column, vertical auto-layout, 24px gap.
- **10:3 "NotificationList"** — vertical list container, 16px item gap.
- **10:4 "NotificationCard"** — 680×96, horizontal auto-layout: avatar (48×48, radius full),
  text block (title + body), timestamp. One component, no variants.

## Tokens

- colors: `--surface #FFFFFF`, `--border #E5E7EB`, `--text #111827`, `--text-muted #6B7280`,
  `--accent #2563EB`
- typography: title `16/24 600`, body `14/20 400`, timestamp `12/16 400`
- spacing: 4/8/16/24 scale
- radii: card 12, avatar full
- shadows: card `0 1px 2px rgba(0,0,0,0.06)`

## Variants and states

- Explicit: `default` only. No hover/focus/disabled variants defined in the file.
- No prototype interactions, no starting points, no reactions on any node.

## Notes for the extractor

- No interaction metadata → prototype flow is `unavailable`.
- No implicit states should be invented; absence of hover/focus is recorded in
  `risks.missing_states`, not guessed.
