# Wireframe rules — loaded only with `--wireframe`

Read this in full before authoring any wireframe screen. Load it ONLY when the
invocation includes `--wireframe`; without the flag, no wireframe-screen block is
emitted. A wireframe here is a clean, themed HTML mockup inside `plan.html` — the
template `<style>` owns the look (theme tokens, helper classes); you write the
content and layout.

## Contents

- What a wireframe is here
- Helper classes
- Theme tokens and spacing
- Renderer-style icons
- Surface presets
- Composition rules
- Good example

## What a wireframe is here

Set the screen's body as a self-contained, semantic HTML fragment inside the
`block-wireframe-screen.html` frame. You never write `<html>`/`<body>`/`<style>`
/`<script>` tags or fixed page width/height — the template supplies the frame,
the theme, and the surface footprint. You write real product content: real
labels, real counts, real dates, real button text grounded in the screen the
plan describes — not lorem or gray bars. This differs from the BuilderIO source
in one way: there is no rough.js sketch overlay or hand-drawn font here, so the
mockup reads as a clean themed surface, not a sketch.

## Helper classes

Bare elements (`h1`/`h2`/`h3`, `p`, `button`, `input`, `<input type="checkbox">`,
`a`, `hr`) are themed automatically — no classes needed. Helper classes carry the
rest (defined once in the template, shared with the core blocks):

- `.wf-card` / `.wf-box` — a bordered, padded container (a panel, a list item).
- `.wf-pill` / `.wf-chip` — a rounded tag or filter; add `.accent` for the
  accent-filled variant (`<span class="wf-pill accent">`).
- `.wf-muted` — secondary/muted text (or use `<small>`).
- `button.primary` / `[data-primary]` — the accent-filled primary button.

No `box-shadow`, `filter: drop-shadow(...)`, or fake depth on a frame or card.
Flat bordered surfaces only; separate with spacing, borders, and labels.

## Theme tokens and spacing

For any inline border, background, or text color, reference a `--wf-*` token —
never a hex/rgb/hsl literal: `style="border:1.4px solid var(--wf-line)"`. The
tokens are listed in `block-vocabulary.md` (`--wf-ink`, `--wf-muted`,
`--wf-line`, `--wf-paper`, `--wf-card`, `--wf-accent`, `--wf-accent-fg`,
`--wf-accent-soft`, `--wf-warn`, `--wf-ok`, `--wf-radius`). Never set
`font-family` — the template owns the font.

Use literal CSS lengths for spacing (`padding:16px`, `gap:12px`,
`margin-top:18px`, `minmax(0,1fr)`) — not spacing tokens, not Tailwind classes.

## Renderer-style icons

For icon-only buttons or leading icons, write an empty marker such as
`<span data-icon="mail" aria-label="Email"></span>` or `<i data-icon="lock"></i>`;
the template's `.wf-icon` styling sizes it. Supported names: `mail`/`email`,
`lock`/`password`, `search`, `plus`/`add`, `x`/`close`, `check`, `chevronDown`,
`chevronUp`, `chevronLeft`, `chevronRight`, `dots`/`more`, `user`, `settings`,
`calendar`, `bell`, `send`, `edit`, `arrowLeft`, `arrowRight`. Do not put visible
words like "email" or "search" where the product UI would show an icon.

## Surface presets

Set `data-surface` on the frame to match the real footprint — never default to a
desktop + mobile pair:

- `browser` — a web page that needs a browser chrome frame.
- `desktop` — a full desktop app page or app shell.
- `mobile` — a phone screen, only when the work is genuinely mobile.
- `popover` — a small floating menu, dropdown, or inline popover.
- `panel` — a side panel, inspector, or sidebar widget.

A sidebar popover renders as a small surface, not a desktop page plus a phone
frame. Emit `desktop` + `mobile` only when responsive layout actually changes.

## Composition rules

- Modify, don't redesign: reproduce the real screen's layout first, then change
  only the delta and call it out with one annotation.
- Keep product screens pure: no file contracts, architecture arrows, repo pills,
  or implementation callouts inside the screen — those belong in the diagram or
  decision blocks.
- Wrap content in a root container with real inner padding (≥14-16px,
  `box-sizing:border-box`, `height:100%`, `gap` between rows) so the first row
  never sits flush to the border.
- Persistent chrome bars (top bars, tab bars) span the full frame width as one
  flex row with a `<div style="flex:1"></div>` spacer pushing trailing actions
  to the edge; pin bottom bars with the frame as a flex column at `height:100%`.
- Lay out with inline flex/grid + `gap` + `min-width:0`; avoid absolute
  positioning, negative margins, or fixed child widths that collide on resize.
- Do not wrap intentionally single-line rows (toolbars, breadcrumbs, file chips):
  add `white-space:nowrap` and ellipsis on the labels.

## Good example

A contacts list, `data-surface="browser"` — helper classes and tokens only, no
hex, no font:

```html
<div style="display:flex;flex-direction:column;gap:12px;padding:16px;height:100%">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <h1>Contacts</h1>
    <button class="primary">New contact</button>
  </div>
  <div style="display:flex;gap:6px">
    <span class="wf-pill accent">All 128</span>
    <span class="wf-pill">Favorites</span>
    <span class="wf-pill">Archived</span>
  </div>
  <div class="wf-card" style="display:flex;flex-direction:column;gap:0;padding:0">
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1.4px solid var(--wf-line)">
      <div style="width:32px;height:32px;border-radius:999px;background:var(--wf-accent-soft)"></div>
      <div style="flex:1"><strong>Jane Cooper</strong><br /><small>jane@acme.co</small></div>
      <span class="wf-pill">Lead</span>
    </div>
  </div>
</div>
```
