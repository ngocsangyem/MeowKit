# MeowKit Design Guideline

Identity: **prompt + cursor**. Light-first, flat colour, one accent.
Tokens: `assets/design-tokens.json` (canonical) · `docs/design/meowkit-tokens.css` (short role names) · `assets/css/colors_and_type.css` (long `--mk-*` names used by the preview pages).
Masters: `assets/branding/`. Preview pages: `assets/preview/`. Construction sheets: `assets/wireframes/`.

---

## 1. Concept

The mark is the two things already on screen when you talk to an agent: the chevron you type after, and the block cursor that waits for the answer. The cursor is given two ears. Nothing is added after that.

- The chevron is the prompt — shell prompt, diff marker, "next" arrow.
- The cursor is the reply — a caret block, with ears cut out of its top edge as negative space.
- No face, no whiskers, no paw, no illustrated mascot.

It is drawn on a grid at 45° and 90° only, so it survives a favicon, a terminal and an embroidery file unchanged.

---

## 2. Logo system

### 2.1 Files

| File | Use for |
| --- | --- |
| `meow-symbol.svg` | The symbol on paper and any light ground |
| `meow-symbol-dark.svg` | The symbol on night and any dark ground |
| `meow-symbol-small.svg` | Cursor only, for sizes under 24px |
| `meow-logo.svg` | Horizontal lockup on light grounds |
| `meow-logo-dark.svg` | Horizontal lockup reversed on dark grounds |
| `meow-logo-mono.svg` | One-colour lockup: print, stamp, single ink |
| `meow-logo-animated.svg` / `.gif` | The blink. GIF for surfaces that strip SVG animation |
| `meow-favicon.svg` / `.ico` / `-16.png` / `-32.png` | Browser tab |
| `meow-apple-touch-icon.png` | 180px home-screen icon |
| `meow-og.png` | 1200 × 630 social card |

### 2.2 Geometry

| Measure | Value |
| --- | --- |
| Symbol viewBox | `8 48 240 170` |
| Chevron | 72 × 112 units, ink |
| Cursor | 120 × 146 units, dusk; two 38 × 38 ears, 44-unit notch |
| Gap, chevron to cursor | 24 units |
| Lockup viewBox | `8 45 876 173` — ratio 5.06 : 1 |
| Gap, symbol to wordmark | 62 units |
| Angles | 45° and 90° only; no curve, no radius |

### 2.3 Wordmark

`meowkit`, lowercase, set in JetBrains Mono and stored as outlines — the file needs no font to render. Never retype it in a live font, never re-space, re-weight or re-case it. In prose the product is **MeowKit**; the CLI is `mewkit`. Only the mark is lowercase.

### 2.4 Clear space and minimum size

- Clear space on all four sides = the width of the cat-cursor (120 units; about 13.7% of the lockup's width). Nothing crosses it.
- Lockup minimum: **96px wide**. Below that, switch to the symbol.
- Symbol minimum: **16px**, via `meow-favicon.svg` or the PNG cuts.
- Under 24px drop the chevron and use `meow-symbol-small.svg` — the cursor alone still reads.

### 2.5 Background usage

| Ground | Cut |
| --- | --- |
| Paper, surface, any light | `meow-logo.svg` / `meow-symbol.svg` |
| Night, any dark | `meow-logo-dark.svg` / `meow-symbol-dark.svg` |
| Haze, single-ink print | `meow-logo-mono.svg` |
| Dusk accent fill | The whole mark in white `#f7f9fc` |

### 2.6 Motion

One animation exists: the cursor blinks like a caret — on, off, 1100ms, stepped. No fade, no easing, nothing else moves. One blinking mark per view. Under `prefers-reduced-motion`, serve the static `meow-logo.svg`.

### 2.7 Do and don't

**Do** — pick the cut that matches the ground; keep the clear space; let the mark carry the only accent on the surface; drop to the small cut before the mark gets illegible.

**Don't** — no gradient, glow, drop shadow or outline on the mark; no rotating, stretching or re-colouring; no rounded joins; no stacked cut; no tagline locked to the mark; no second animation beside the blink.

---

## 3. Colour

One accent. Flat fills. Light is the default; night is the dark theme, the terminal fill, and the ink of body text on paper.

### 3.1 Palette

| Role | Hex | Use |
| --- | --- | --- |
| Mist paper | `#eef2f7` | Page ground, light |
| Surface | `#e0e7f0` | Cards, panels, secondary buttons |
| Haze | `#c8d5e6` | Lit frames, footers, hover fills |
| Night | `#131a27` | Ink, terminals, dark-mode ground |
| Night raised | `#1b2435` | Cards and panels on night |
| White | `#f7f9fc` | Text on dusk |
| **Dusk** | `#2f66b3` | The one accent on light grounds |
| **Sky** | `#8fb5e8` | The one accent on night |
| Muted | `#566178` | Secondary text on paper |
| Muted dark | `#9aa6bb` | Secondary text on night |

Signals: success `#2f7a55`, warning `#9a5d0c`, danger `#b13f37`; on night `#7fc4a0`, `#e3b46a`, `#ef9a90`.
Hairlines: `rgb(19 26 39 / 0.13)` on paper, `rgb(238 242 247 / 0.12)` on night.

### 3.2 Contrast

| Pair | Ratio | Rule |
| --- | --- | --- |
| Ink `#131a27` on paper | 15.5:1 | Body text, headings, nav labels |
| Paper on night | 15.5:1 | Body text in dark mode |
| Sky on night | 8.3:1 | Links, labels and accents on night |
| Muted dark on night | 7.1:1 | Secondary text on night |
| Muted `#566178` on paper | 5.5:1 | Captions, labels, metadata — **not body text** |
| White on dusk | 5.4:1 | Text on an accent fill |
| Dusk on paper | 5.1:1 | Labels, links, fills, the mark — **never body text** |

Body copy is always ink on paper or paper on night. Dusk is a colour for things you click, label or fill, not for sentences; where a dusk link sits in running text, use `#26559a` (6.6:1) and underline it.

### 3.3 Fills

Large areas take one solid colour: dusk for an accent panel, night for terminals and hero blocks, haze for quiet frames. No gradient fills and no gradient text. `--mk-gradient-brand` and `--mk-gradient-space` survive in the CSS only so existing callers keep working; both resolve to a single flat colour.

No glow, no blur, no `filter`, no texture. Depth is the step between paper, surface and haze, plus a hairline. A drop shadow is the exception (`--mk-shadow-card`, `--mk-shadow-lift`) and is low-opacity night, never tinted.

---

## 4. Typography

| Role | Face | Size / weight |
| --- | --- | --- |
| Display | Newsreader 400 | 56 / 1.04, tracking −0.024em |
| h1 | Newsreader 400 | 48 / 1.15, −0.02em |
| h2 | Newsreader 400 | 36 / 1.15, −0.02em |
| h3 | Onest 500 | 28 / 1.3 |
| h4 | Onest 600 | 22 / 1.3 |
| Lede | Onest 400 | 20 / 1.45 |
| Body | Onest 400 | 16 / 1.6 |
| Caption | Onest 400 | 13 / 1.55, muted |
| Label, eyebrow | JetBrains Mono 500 | 11–13, uppercase, +0.1em |
| Code | JetBrains Mono 400 | 13–14 / 1.7 |

- **Newsreader** is the one warm thing beside a monospace command and a flat blue block. Always 400, never bold, never in dusk. One display line per screen.
- **Onest** runs text and buttons: 400 for copy, 500 for buttons and h3.
- **JetBrains Mono** carries the wordmark, commands, paths, counts and UI labels. Uppercase with +0.14em tracking is the eyebrow — the only place caps are allowed.
- Docs code blocks fall back to the platform monospace: a latin-subset webfont shears box-drawing diagrams.

Fonts load from Google Fonts. Self-hosted `.woff2` files are not bundled — ask before shipping offline or commercially.

---

## 5. Components

| Component | Shape |
| --- | --- |
| Button | Pill (`99px`), 44px tall, Onest 500. Primary = ink fill; accent = dusk fill, white text; secondary = surface fill |
| Card | 8px radius, flat surface, one hairline. Hover moves the border to dusk and nothing else |
| Chip | 4px radius, mono 12px, hairline border, no fill |
| Verdict pill | Solid signal fill, white text, one uppercase word |
| Field | 6px radius, hairline; focus adds a solid 3px dusk ring, never removed |
| Callout | Surface card with a 3px signal bar on the left |
| Code block | Night `#131a27`, paper text, four syntax roles |
| Table | Mono uppercase headers in dusk, hairline rows, zebra onto surface |

Spacing is a 4-based scale: 4, 8, 12, 16, 24, 32, 48, 64, 80. Cards pad at 16–24; sections breathe at 48–80.
Motion: 120ms for hover, 240ms for state changes, `cubic-bezier(0.2, 0.8, 0.2, 1)`. No bounce, no parallax, no scale on press.

---

## 6. Iconography

There is no bundled icon set. Use Unicode glyphs that match the terminal (`✓ ✗ → ×`), ASCII box-drawing for trees and phase diagrams, and one topic emoji per feature card — at the start, never mid-sentence. If a third-party icon set is substituted, say so in the output.

---

## 7. Voice

Direct, terse, technical. Active voice, short sentences, no throat-clearing. No exclamation points, no marketing verbs, no AI-speak. Tables over paragraphs. Claims come from `README.md`; do not invent numbers.
