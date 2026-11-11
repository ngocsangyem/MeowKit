# MeowKit Design System

> **AI agent toolkit for Claude Code** — enforced discipline, a 7-phase workflow, zero external deps.

Design tokens, type, the logo masters and preview pages for the MeowKit product surface. Use it to brand prototypes, slides, docs or production UI consistently.

---

## Product context

**MeowKit** installs a `.claude/` directory that Claude Code reads at the start of a session. It runs a 7-phase workflow (Orient → Plan → Test → Build → Review → Ship → Reflect) with two hard gates, TDD opt-in, layered security scanning and cross-session memory. It ships as an npm CLI (`npx mewkit init`) plus a documentation site at [docs.meowkit.dev](https://docs.meowkit.dev/).

Numbers for copy that references scale, from the root `README.md`: **129 skills · 42 agents · 7 rules · 27 hook scripts · 4-layer+ security**.

---

## The mark — prompt + cursor

Two shapes that are already on screen when you talk to an agent: the **chevron** you type after, and the **block cursor** that waits for the answer. The cursor has two ears cut out of its top edge. Nothing is added after that.

- Chevron in night `#131a27` — the prompt.
- Cursor in dusk blue `#2f66b3` — the reply. On night it flips to paper and sky.
- Wordmark `meowkit`, lowercase, JetBrains Mono, stored as outlines.
- 45° and 90° angles only. No curve, no radius, no gradient, no glow.

The whole system is flat: there is no illustrated mascot, no face, no paw.

---

## Index

| File / folder | What's in it |
| --- | --- |
| `README.md` | This file — context, the mark, palette, type, usage rules |
| `SKILL.md` | Agent Skills manifest — makes this system usable as a Claude Code skill |
| `design-tokens.json` | Canonical token source (mirrored to `docs/design/` and `packages/mewkit/assets/`) |
| `css/colors_and_type.css` | CSS variables: brand primitives, light/night themes, typography roles |
| `branding/` | The logo masters — see the table below |
| `preview/` | Design-system preview pages (brand, colour, type, spacing, components) |
| `wireframes/` | Construction sheets: how the mark is built, one-colour cuts, lockup measures |

Related: `docs/design/meowkit-design-guideline.md` (the written guideline) and `docs/design/meowkit-tokens.css` (the same tokens under short role names).

---

## Branding files

| File | Use for |
| --- | --- |
| `meow-symbol.svg` | The symbol on paper and any light ground |
| `meow-symbol-dark.svg` | The symbol on night and any dark ground |
| `meow-symbol-small.svg` | Cursor only — the cut for sizes under 24px |
| `meow-logo.svg` | Horizontal lockup, light grounds |
| `meow-logo-dark.svg` | Horizontal lockup reversed, dark grounds |
| `meow-logo-mono.svg` | One-colour lockup: print, stamp, single ink |
| `meow-logo-white.svg` | One-colour white lockup (`#f7f9fc`) for dusk or night fills |
| `meow-symbol-white.svg` | One-colour white symbol for dusk or night fills |
| `meow-logo-animated.svg` | The lockup with the cursor blinking (SMIL, stays crisp) |
| `meow-logo-animated.gif` | Same blink, 608 × 120, for surfaces that strip SVG animation |
| `meow-favicon.svg` | Browser tab — cursor on a night tile |
| `meow-favicon.ico` | Browser tab fallback, 16 + 32 |
| `meow-favicon-16.png` · `-32.png` | Raster favicons |
| `meow-apple-touch-icon.png` | 180 × 180 home-screen icon |
| `meow-og.png` | 1200 × 630 social card |

Geometry, for anyone rebuilding a layout around it: the symbol viewBox is `8 48 240 170` (chevron 72 × 112, cursor 120 × 146, gap 24); the lockup viewBox is `8 45 876 173`, ratio 5.06 : 1, with 62 units between the cursor and the first letter.

---

## Usage rules

- **Clear space** — the width of the cat-cursor on all four sides (120 units; about 13.7% of the lockup's width). Nothing crosses it.
- **Minimum size** — lockup **96px wide**; symbol **16px** (use the favicon there). Under 24px drop the chevron and use `meow-symbol-small.svg`.
- **Pick the cut, don't re-colour** — light ground takes `meow-logo.svg`, dark takes `-dark`, single ink takes `-mono`, a dusk fill takes the whole mark in white `#f7f9fc`.
- **Never redraw the mark in live text.** The wordmark is outlined in the file; typing `meowkit` in a font is not the wordmark.
- **No effects** — no gradient, glow, drop shadow, outline, rotation or stretch.
- **One blink per view.** The cursor blinks on, off, 1100ms, stepped. Honour `prefers-reduced-motion` by serving the static SVG.

---

## Palette

One accent, flat fills, light by default.

| Role | Hex | Use |
| --- | --- | --- |
| Mist paper | `#eef2f7` | Page ground, light mode |
| Surface | `#e0e7f0` | Cards, panels, secondary buttons |
| Haze | `#c8d5e6` | Lit frames, footers, hover fills |
| Night | `#131a27` | Ink, terminals, dark-mode ground |
| Night raised | `#1b2435` | Cards and panels on night |
| White | `#f7f9fc` | Text on dusk |
| **Dusk** | `#2f66b3` | The one accent on light grounds |
| **Sky** | `#8fb5e8` | The one accent on night |
| Muted | `#566178` | Secondary text on paper |
| Muted dark | `#9aa6bb` | Secondary text on night |

Signals: success `#2f7a55`, warning `#9a5d0c`, danger `#b13f37` — on night `#7fc4a0`, `#e3b46a`, `#ef9a90`.
Hairlines: `rgb(19 26 39 / 0.13)` on paper, `rgb(238 242 247 / 0.12)` on night.

**Contrast** — ink on paper 15.5:1, paper on night 15.5:1, sky on night 8.3:1, muted-dark on night 7.1:1, muted on paper 5.5:1, white on dusk 5.4:1, dusk on paper 5.1:1. Body text is always ink on paper or paper on night. Dusk is for labels, links, fills and the mark — never for sentences; a dusk link inside running text uses `#26559a` (6.6:1) with an underline.

**No gradients.** `--mk-gradient-brand` and `--mk-gradient-space` remain in the CSS so existing callers keep working, and both resolve to a single flat colour.

---

## Typography

| Role | Face | Size / weight |
| --- | --- | --- |
| Display | Newsreader 400 | 56 / 1.04, tracking −0.024em |
| h1 · h2 | Newsreader 400 | 48 and 36, −0.02em |
| h3 · h4 | Onest 500 · 600 | 28 and 22 |
| Lede | Onest 400 | 20 / 1.45 |
| Body | Onest 400 | 16 / 1.6 |
| Caption | Onest 400 | 13 / 1.55, muted |
| Label, eyebrow | JetBrains Mono 500 | 11–13, uppercase, +0.1em |
| Code | JetBrains Mono 400 | 13–14 / 1.7 |

Newsreader is the one warm thing beside a monospace command — always 400, never bold, never in dusk. Onest runs text and buttons. JetBrains Mono carries the wordmark, commands, paths, counts and UI labels; uppercase mono is the eyebrow, and the only place caps are allowed. Docs code blocks fall back to the platform monospace, because a latin-subset webfont shears box-drawing diagrams.

---

## Shape, spacing and motion

- **Radii** — 4px chips and inline code, 6px fields, 8px cards and code blocks, pill buttons. 16 and 24 exist for large containers.
- **Spacing** — 4-based: 4, 8, 12, 16, 24, 32, 48, 64, 80. Cards pad at 16–24; sections at 48–80.
- **Borders** — always 1px hairlines. Brand-coloured borders only on hover or focus.
- **Elevation** — the step between paper, surface and haze, plus the hairline. Shadows are the exception (`0 2px 8px` at 6%, `0 8px 24px` at 10%), low-opacity night, never tinted.
- **Focus** — a solid 3px dusk ring (sky on night). Never removed, never replaced by a glow.
- **Motion** — 120ms hover, 240ms state change, `cubic-bezier(0.2, 0.8, 0.2, 1)`. No bounce, no parallax, no scale on press.
- **No blur** — no `filter`, no `backdrop-filter`, no translucent navbar.

---

## Content

**Voice.** Direct, terse, technical, confident. Active voice, short sentences, no throat-clearing — the way an engineer writes a PR description.

**Casing.** Product name **MeowKit**, one word. CLI lowercase `mewkit` (the dropped "o" is the npm package name). Skills `/mk:cook`, `/mk:fix`, `/mk:plan-creator` — lowercase, slash-prefixed, colon-namespaced. Phases title-cased with a number (**Phase 3 Build**). Gates bold and numbered (**Gate 1**).

**Emphasis.** Bold on the first mention of a technical noun; `code` for paths, env vars, flags and every command; blockquotes for thesis statements, rarely. Never italic.

**Emoji.** One topic emoji per feature card, at the start — 🔒 gates, 🧪 TDD, 🛡️ security, 🧠 agents, ⚡ skills, 💾 memory. Never mid-sentence, never in body prose, never decorative. CLI output uses `✓ ✗ → ✋`.

**Tables and diagrams.** Tables carry most reference content; cells hold a phrase, not a sentence. Diagrams are inline ASCII with `→` arrows and square brackets for gates.

**Don't.** No exclamation points. No marketing verbs ("revolutionize", "unleash", "seamlessly"). No AI-speak ("let's dive in"). No long summaries.

---

## Iconography

No bundled icon font or SVG set. In order of preference:

1. **Unicode** — `✓ ✗ → ✋ ⚠ × ⌕ ≡ ⧉`, matching the terminal.
2. **ASCII box-drawing** — `├── │ └──` for trees, `→ [GATE 1]` for phase diagrams.
3. **One topic emoji** per feature card.

If a third-party set is substituted (for example Lucide, stroke 1.5), flag the substitution in the output — it is not native to the brand.

---

## Known gaps

- **Fonts are not bundled.** Newsreader, Onest and JetBrains Mono load from Google Fonts by `<link>`. Ask for self-hosted `.woff2` files before shipping offline or commercially.
- **No icon set.** See above.
- **No Figma file.** Everything is reconstructed from the tokens and the SVG masters in `branding/`, which are the source of truth.
