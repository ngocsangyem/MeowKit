# Pre-Flight Checklist

Run before any Figma MCP operation. 18 items. STOP on any failure.

## File Access (4 items)

- [ ] 1. **File key valid** — URL matches regex, file key extracted successfully
- [ ] 2. **File accessible** — MCP can read the file (not 403/404)
- [ ] 3. **Page accessible** — target page exists in file, page switch succeeded
- [ ] 4. **Node exists** — target node ID resolves to an actual node on current page

## Typography (2 items)

- [ ] 5. **Fonts loaded** — all fonts used by text nodes loaded via `loadFontAsync`
- [ ] 6. **Font availability** — fonts are available in the environment (not missing system fonts)

## Variables & Styles (3 items)

- [ ] 7. **Variables in scope** — local variables accessible; no cross-file variable refs unresolved
- [ ] 8. **No name conflicts** — new variable names don't duplicate existing variable names
- [ ] 9. **Color styles present** — design uses named color styles (not raw hex), styles are published

## Rate Limits & Performance (2 items)

- [ ] 10. **Rate limit headroom** — not in a retry backoff window from a previous request
- [ ] 11. **Node count reasonable** — target node has < 500 child nodes (larger trees need pagination)

## Design System (3 items)

- [ ] 12. **Design system detected** — project's existing system identified (Tailwind / MUI / shadcn / custom)
- [ ] 13. **Components matched** — Figma components mapped to existing project components where possible
- [ ] 14. **Responsive breakpoints defined** — Figma constraints map to known CSS breakpoints

## Assets (2 items)

- [ ] 15. **Assets exportable** — icons/images have export settings configured in Figma
- [ ] 16. **Asset formats correct** — icons are SVG, photos are raster (WebP/PNG), no mixed-up formats

## Structure (2 items)

- [ ] 17. **Auto-layout detected** — layout mode (auto vs absolute) identified for each frame
- [ ] 18. **Prototype links noted** — interactive states (hover, active, focus) documented from prototype links

## On Failure

| Check | Action |
|---|---|
| 1–4 (file/node access) | Report URL/access issue, ask user to verify Figma link |
| 5–6 (fonts) | Run `loadFontAsync` for all missing fonts before proceeding |
| 7–9 (variables) | Resolve variable scope or rename conflicts before creating new vars |
| 10–11 (rate/size) | Wait for backoff, or paginate large node trees |
| 12–14 (design system) | Default to CSS custom properties if no system detected |
| 15–16 (assets) | Ask user to configure export settings in Figma |
| 17–18 (structure) | Infer from screenshot if context is ambiguous |
