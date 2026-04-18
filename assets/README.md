# MeowKit Design System

> **AI Agent Toolkit for Claude Code** — enforced discipline, 7-phase workflow, zero external deps.

This project contains the design tokens, type system, iconography, and UI kits used across the MeowKit product surface. Use it to brand new prototypes, slides, docs, or production UIs consistently.

---

## Product context

**MeowKit** installs a `.claude/` directory that Claude Code reads at session start. It enforces a structured 7-phase workflow (Orient → Plan → Test → Build → Review → Ship → Reflect) with two hard gates, TDD opt-in, 4-layer security scanning, and cross-session memory. It ships as an npm CLI (`npx mewkit init`) plus a documentation site.

Core numbers (for copy that references scale): **58+ skills · 15+ agents · 18+ commands · 7+ modes · 17+ rules · 9+ hooks · 4-layer+ security**.

### Primary mark — Slash-Meow Prompt

The official MeowKit logo is **`/meow`** rendered as a slash-command prompt with a blinking caret. It reads directly from the product's core invocation pattern: every skill in the kit starts with `/meow:` — so the mark *is* the command. CLI-native, code-native, scales from favicon to banner without bitmap assets.

- Slash `/` in solid brand blue `#2563EB` (weight 600) — the accent hit
- `meow` in **Fira Code 500**, filled with the brand gradient `#1D4ED8 → #3B82F6`
- Caret block in brand blue, blinking at 1.1s
- On dark surfaces, slash + caret shift to accent glow `#60A5FA`, gradient shifts to `#93C5FD → #60A5FA`

The face of the brand is not a character — it's the command itself. Signals: CLI-first, code-first, disciplined (slash = command boundary), playful (the wordplay on `meow`).

### Products represented

| Surface | What it is | Where the visuals come from |
|---|---|---|
| **CLI** (`mewkit`) | npm-distributed command runner — `init`, `setup`, `doctor`, `validate`, `budget`, `memory` | Monospace terminal output with ✓/✗ glyphs and `meow:` namespaced skill calls |
| **Docs website** | VitePress site at `docs.meowkit.dev` — home, guide, workflows, reference, cheatsheet | `website/.vitepress/theme/custom.css` — full 4-layer token system |
| **`.claude/` runtime** | Markdown agents / skills / rules consumed by Claude Code itself | Plain Markdown, code blocks, tables — very CLI-native |

### Sources

All visual context was pulled from the public repo **[ngocsangyem/MeowKit](https://github.com/ngocsangyem/MeowKit)** (default branch `main`). Key files:

- `assets/branding/design-tokens.json` — canonical theme JSON
- `website/.vitepress/theme/custom.css` — 4-layer CSS variable system with full light + dark themes
- `website/index.md` — hero copy + feature list
- `website/introduction.md`, `why-meowkit.md`, `cheatsheet.md`, `quick-start.md` — tone + voice samples
- `README.md` + `CLAUDE.md` — product positioning

No Figma was provided. All tokens were reconstructed from the CSS + JSON above — which is itself the source of truth in the repo.

---

## Index

| File / folder | What's in it |
|---|---|
| `README.md` | This file — context, foundations, content rules, iconography |
| `SKILL.md` | Agent Skills manifest — makes this system usable as a downloadable Claude Code skill |
| `colors_and_type.css` | All CSS variables (brand primitives, light/dark tokens, typography roles) |
| `assets/branding/` | `design-tokens.json` canonical token source |
| `preview/` | Design-system preview cards (colors, type, spacing, components, brand) |
| `ui_kits/website/` | VitePress-style docs site recreation — hero, features, sidebar, code blocks |
| `ui_kits/cli/` | Terminal UI kit — `mewkit init`, `/meow:cook`, `/meow:ship` simulated sessions |

---

## Visual foundations

### Palette

- **Primary — Royal Blue `#2563EB`**: the signature mascot collar. Used on links, primary buttons, active sidebar items, focus rings, brand gradients.
- **Accent glow `#60A5FA`**: the dark-mode "brand" substitute. Hero titles, active nav text, inline-code color, link hover.
- **Neutrals — slate family** (`#F8FAFC` → `#05070A`): all backgrounds, borders, and text. Never pure black; dark-mode base is `#0F172A` (blue-tinted slate-900).
- **Semantic**: success `#12B76A`, warning `#F79009`, danger `#F04438`, info = brand blue.
- **Gradient**: `linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)` — applied as `background-clip: text` on hero titles and as a solid fill on primary buttons.

Dark mode is the hero mode. Light mode exists and works, but screenshots, hero art, and the mascot background all assume dark.

### Typography

- **Sans — Inter** (all UI + body copy). From `design-tokens.json`: headings are `fontWeight: 400` with `letterSpacing: 0.02em` — not bold, airy, tech-forward.
- **Mono — Fira Code** with Geist Mono / JetBrains Mono fallbacks. Used for terminal output, code blocks, `mk:` skill refs, eyebrows.
- Headings go up to ~48–64px for hero. Body is 15–16px. Tables and reference content drop to 13–14px.
- ALL CAPS is reserved for eyebrows / section markers (mono, 12px, +0.12em tracking).

### Spacing

4-based scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`. Cards pad at 16–24; sections at 48–80. Sidebar items pad 6–8 vertical.

### Backgrounds

- Light mode: layered slate neutrals — `#F8FAFC` base, `#FFFFFF` surface, `#F1F5F9` soft.
- Dark mode: slate-900 base, slate-800 surface, **deep-space blue `#1E3A5F` soft** — this deep blue is the mascot halo colour and shows up under code blocks and elevated surfaces.
- No full-bleed hero images. No patterns. No textures. Occasional subtle radial gradients on hero sections (blue glow bottom-center).

### Borders

Always thin (1px) and subtle:
- Light: `#E2E8F0` subtle, `#CBD5E1` strong.
- Dark: `rgba(255,255,255,0.08)` subtle, `rgba(255,255,255,0.15)` strong.
- Brand-colored borders only on hover/focus of feature cards (`rgba(37,99,235,0.4)`).

### Corners

Small by default. `4px` on buttons (explicit from `design-tokens.json`), `6–10px` on inputs and small cards, `16px` on feature cards and modals. Pills (`9999px`) only for badges.

### Shadows

Understated. Light mode uses `0 2px 8px rgba(15,23,42,0.06)` on cards. Dark mode mostly uses **glow** instead: `0 0 20px rgba(37,99,235,0.35)` for focused / primary affordances. Inner 1-px glow (`inset 0 0 0 1px rgba(96,165,250,0.35)`) on feature-card hover in dark.

### Transparency & blur

Used sparingly. Navbar has a translucent backdrop (`rgba(15,23,42,0.85)` in dark, `rgba(245,247,250,0.85)` in light) with `backdrop-filter: blur(12px)`. Hover states use 6–15% brand-tinted overlays rather than changing the base color.

### Motion

Short, linear-ish easing. `150ms` for hover / color transitions, `250ms` for larger state changes, `400ms` max. Preferred easing `cubic-bezier(0.2, 0.8, 0.2, 1)`. No bounces. No parallax. Feature cards change border-color on hover — no transform, no scale.

### Hover / press

- Hover: background tints to 6–15% brand alpha; links brighten (`blue-600` → `blue-500` in light; `accent-glow` → `accent-soft` in dark); feature cards deepen border.
- Press: we don't scale buttons. Primary button: `opacity: 0.9`. Secondary: background fills with `mk-active-bg`.

### Focus

Always a 3px outer ring in brand color (`rgba(37,99,235,0.35)` light / `rgba(96,165,250,0.45)` dark). Never removed.

### Cards

Flat surface (`--mk-bg-surface`), thin subtle border, small shadow in light / no shadow in dark, 10–16px radius. Hover → border darkens to brand. No colored left-border accents. No gradients.

### Layout rules

- Max content width: ~1200px for docs-style layouts, ~720px for prose.
- Fixed top navbar, fixed left sidebar on docs pages.
- Right-rail "on this page" TOC at wide breakpoints.
- Everything else is standard left-to-right reading flow.

---

## Content fundamentals

### Voice

Direct, terse, technical, confident. "Enforced discipline, not best practices." Writes the way engineers talk in a PR description: active voice, short sentences, no throat-clearing.

Sample one-liners (real, from the site):

> "AI coding tools are powerful but undirected."
> "The cost of a bad ship > the cost of a 30-second approval."
> "Every step is visible. Every claim is verified."
> "Rules define why; hooks enforce what."

### Address

Mostly second-person **"you"** for guides ("When you start a Claude Code session…"), third-person for architectural descriptions ("MeowKit fixes this by…"). Rarely first-person; avoid "we".

### Casing

- Product name: **MeowKit** (one word, camel-cased both halves).
- CLI: lowercase `mewkit` — yes, dropped "o", that's intentional (npm package name).
- Commands: `/meow:cook`, `/meow:fix`, `/meow:plan` — always lowercased, slash-prefixed, colon-namespaced.
- Skills: `meow:agent-detector`, `meow:plan-creator` — lowercase-kebab.
- Agents: lowercase single-word or hyphenated (`orchestrator`, `ui-ux-designer`).
- Phases: title-cased with number — **Phase 3 Build**.
- Gates: **Gate 1**, **Gate 2** — bold, numbered.

### Emphasis

- **Bold** for first mention of technical nouns and for `IMPORTANT:` prefixes inside agent docs.
- `code` for file paths, env vars (`MEOWKIT_TDD=1`), CLI flags (`--tdd`), and every command.
- `>` blockquotes for thesis statements (rare, punchy).
- Never italic.

### Emoji

**Used, but sparingly and purposefully.** Feature cards on the homepage each lead with a single topic emoji: 🔒 (gates), 🧪 (TDD), 🛡️ (security), 🧠 (agents), ⚡ (skills), 💾 (memory), 📋 (tasks), 🎯 (routing), 🗣️ (party), 🔍 (review), 🚦 (hooks), 🧭 (help). One emoji per card, always at the start. Never mid-sentence. Never in body prose. Never decorative 🚀✨ / sparkles.

Also used in CLI output: `✓` (ASCII check), `✗` (cross), `✋` (gate marker in tables), `→` (arrow between states).

### Tables

Heavy use. Almost every reference page has 2+ tables. Columns are terse — single words or short phrases. No full-sentence cells. Headers sentence-case.

### Diagrams

Inline ASCII boxes with `→` arrows and square brackets for gates:

```
Phase 0 Orient → Phase 1 Plan [GATE 1] → Phase 2 Test
→ Phase 3 Build → Phase 4 Review [GATE 2] → Phase 5 Ship → Phase 6 Reflect
```

### Vibe

Think: "Tailwind docs × Rust `cargo` output × a cat sticker on a terminal." Crisp, accountable, slightly smug. Assumes the reader is an engineer who respects their tools.

### Don't

- No exclamation points (exception: "Best kit so far!" in the credits — singular).
- No marketing fluff ("revolutionize", "unleash", "seamlessly", "powerful", "magical").
- No AI-speak ("Let's dive in", "In this guide we'll…").
- No long summaries — the `cheatsheet.md` style is the north star.

---

## Iconography

MeowKit has **no bundled icon font or SVG set**. Iconography is:

1. **Emoji** — one per feature card, mapped by topic (see Content → Emoji above). This IS the icon system on the homepage.
2. **Unicode glyphs** — `✓ ✗ → ✋ ⚠️` in CLI output and tables.
3. **ASCII box-drawing / diagrams** — `├── │ └──` in tree listings, `→ [GATE 1]` in phase diagrams. Monospace.
4. **The `/meow` slash-prompt mark** — the sole brand glyph, typographic, no bitmap artwork needed.

No Lucide, no Heroicons, no Material icons in the source. When building UIs that need generic UI affordances (close, search, menu, copy), either:
- Use **Unicode** (`×`, `⌕`, `≡`, `⧉`) — matches the CLI/terminal aesthetic, recommended default.
- Or substitute **Lucide** stroke-1.5 icons from CDN (`https://unpkg.com/lucide-static/icons/...`) — closest match to the clean tech feel. **Flag this substitution when you use it** — it's not native to the brand.

### Assets inventory (`assets/branding/`)

| File | Use for |
|---|---|
| `design-tokens.json` | Canonical token JSON — don't edit; mirror into `colors_and_type.css` |

The logo is produced in code (Fira Code 500 + gradient + caret); there are no bitmap logo files. See `preview/brand-logo.html` and `preview/logo-hifi.html` for the mark at every size and variant.

---

## Known gaps & flags

- **Fonts not bundled.** The repo references Inter + Fira Code by name but doesn't ship `.ttf` / `.woff2` files. This system loads them from Google Fonts via `<link>`. **Ask the user for self-hosted font files if you need offline / commercial distribution.**
- **No icon set.** Flagged above. If you add Lucide, note the substitution in the output's footer.
- **No Figma file.** All component recreations are reconstructed from CSS + screenshots of the live VitePress site. Minor rendering differences from the official site are expected.
- **Light-mode is secondary.** The website ships dark-mode by default visually. Light mode tokens are complete but less exercised.
