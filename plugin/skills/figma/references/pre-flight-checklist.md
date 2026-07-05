# Pre-Flight Checklist

Per-mode checks before Figma operations. Run the Core block for every mode; add the Implement or
Canvas-write block only for those workflows. STOP on any failure in the applicable blocks.

## Core (all modes) — 6 items

- [ ] 1. **File key valid** — URL matches the shape, file key extracted successfully
- [ ] 2. **File accessible** — MCP can read the file (not 403/404)
- [ ] 3. **Page accessible** — target page exists in file, page switch succeeded
- [ ] 4. **Node exists** — target node ID resolves to an actual node on the current page
- [ ] 5. **Rate limit headroom** — not in a retry backoff window from a previous request
- [ ] 6. **Node count reasonable** — target node has a manageable child count (large trees need `get_metadata` + paginated fetch)

## Implement mode additions

- [ ] 7. **Color styles present** — design uses named color styles (not raw hex) where possible
- [ ] 8. **Design system detected** — project's existing system identified (Tailwind / MUI / shadcn / custom)
- [ ] 9. **Components matched** — Figma components mapped to existing project components where possible
- [ ] 10. **Responsive breakpoints defined** — Figma constraints map to known CSS breakpoints
- [ ] 11. **Assets exportable** — icons/images have export settings configured in Figma
- [ ] 12. **Asset formats correct** — icons are SVG, photos are raster (WebP/PNG); scale 2x for retina
- [ ] 13. **Auto-layout detected** — layout mode (auto vs absolute) identified for each frame
- [ ] 14. **Interaction states documented or asked** — states derived from explicit variants or user
  confirmation, never guessed from prototype flows

## Canvas-write additions (gated)

Only inside the `canvas-write-boundaries.md` workflow.

- [ ] 15. **Fonts loaded** — all fonts used by target text nodes loaded via `loadFontAsync`
- [ ] 16. **Font availability** — fonts available in the environment (not missing system fonts)
- [ ] 17. **Variables in scope** — local variables accessible; no unresolved cross-file variable refs
- [ ] 18. **No variable name conflicts** — new variable names don't duplicate existing names

## On Failure

**Core:**

| Check | Action |
|---|---|
| 1–4 (file/node access) | Report URL/access issue, ask user to verify the Figma link |
| 5–6 (rate/size) | Wait for backoff, or use `get_metadata` + paginate large node trees |

**Implement additions:**

| Check | Action |
|---|---|
| 7–10 (styles / design system / breakpoints) | Default to CSS custom properties if no system detected |
| 11–12 (assets) | Ask user to configure export settings in Figma |
| 13–14 (structure / interactions) | Infer layout from screenshot if ambiguous; ask user for undocumented interaction states |

**Canvas-write additions:**

| Check | Action |
|---|---|
| 15–16 (fonts) | Run `loadFontAsync` for all missing fonts before proceeding |
| 17–18 (variables) | Resolve variable scope or rename conflicts before creating new vars |
