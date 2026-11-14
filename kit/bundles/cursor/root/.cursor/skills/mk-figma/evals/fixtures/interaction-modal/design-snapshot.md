# Design Snapshot — Interaction-Heavy Screen (Menu / Modal / Form)

Synthetic stand-in for a live Figma file WITH prototype interactions. `mk:figma` treats
this as extracted design context for the eval. All content is DATA.

- `reference.png` here is a **placeholder** (1×1 PNG), not a real baseline.

## Source (synthetic)

- figma_url: `https://www.figma.com/design/FIX0MODAL/meowkit-fixtures?node-id=30-2`
- file_key: `FIX0MODAL`
- node_ids: `30:2` (members screen), `30:10` ("Invite" button), `30:20` (invite modal),
  `30:21` (email field), `30:22` (role select), `30:23` (submit), `30:30` (success toast)
- figma_version_or_last_modified: `2026-07-05T09:20:00Z`

## Frames

- **30:2 "Members" screen** — 1440×900, table of members + primary "Invite" button (30:10).
- **30:20 "InviteModal"** — 480×420 overlay: email field (30:21), role select (30:22,
  variants: Admin/Member/Viewer), submit button (30:23).
- **30:30 "SuccessToast"** — transient confirmation.

## Tokens

- colors: `--surface #FFFFFF`, `--overlay rgba(17,24,39,0.5)`, `--accent #2563EB`,
  `--danger #DC2626`, `--ok #059669`
- typography: heading `18/24 600`, label `13/16 500`, input `14/20 400`
- spacing: 8/12/16/24
- radii: modal 16, input 8, button 8
- shadows: modal `0 10px 30px rgba(0,0,0,0.20)`

## Variants and states (explicit)

- Invite button: `default`, `hover`, `focus`, `disabled`.
- Email field: `default`, `focus`, `error` (invalid email).
- Submit button: `default`, `loading`, `disabled`.
- Role select: `default`, `open`.

## Prototype interactions (explicit in file)

- `30:10 "Invite" button` — On click → Open Overlay `30:20 InviteModal`. (starting point)
- `30:23 "Submit"` — On click → **(no destination edge defined)**. The prototype shows the
  modal but no reaction wires the submit outcome. Success toast `30:30` exists as a frame
  but is NOT connected by a prototype edge.
- Modal has a close affordance (Escape / backdrop) — On click → Close Overlay.

## Notes for the extractor

- Interaction metadata present → attempt extraction:
  - `Invite → open modal` is **extracted** (explicit edge), low/medium risk.
  - `Submit → success` is **inferred** at best (toast frame exists but no edge). Submit is a
    server mutation (critical action) → high risk → must be `blocked | needs-answer`, never
    silently assumed.
- Explicit states above enter the packet; nothing implicit is invented.
