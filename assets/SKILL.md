---
name: meowkit-design
description: Use this skill to generate well-branded interfaces and assets for MeowKit (AI Agent Toolkit for Claude Code), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation

- **Primary mark:** prompt + cursor — an ink `>` chevron `#131a27` beside a block cursor with cat ears in dusk blue `#2f66b3`, plus the lowercase JetBrains Mono wordmark `meowkit`. Always used from the SVG files in `branding/`; never redrawn in live text. See `preview/brand-logo.html` and `preview/logo-hifi.html`.
- **Palette:** mist paper `#eef2f7`, surface `#e0e7f0`, haze `#c8d5e6`, night `#131a27` for ink, terminals and dark mode, one accent dusk `#2f66b3` (sky `#8fb5e8` on night), muted text `#566178`. Flat colour only — no gradients, no glows.
- **Type:** Newsreader 400 for headlines, Onest 400/500 for text and buttons, JetBrains Mono for the wordmark, commands and labels.
- **Shape:** pill buttons, 8px cards, 4px chips, 1px hairlines, light-first.
- **Tokens:** canonical in `design-tokens.json`; CSS variables in `css/colors_and_type.css` (long `--mk-*` names, used by `preview/`) and `docs/design/meowkit-tokens.css` (short role names).
- **Sheets:** `preview/` for the design system, `wireframes/` for how the mark is constructed.
- **Voice:** CLI-first, disciplined, playful-adjacent. Slash-commands (`/mk:plan-creator`), Unicode glyphs (`✓ ✗ → ✋`), no illustrated mascot.
