# Design Review Checklist (Lite)

> Lite design review for `meow:review` + `meow:ship` pre-landing. Source-level pattern detection — not rendered-output audit. For full visual audit, use an external tool.

## Instructions

This checklist applies to **source code in the diff** — not rendered output. Read each changed frontend file (full file, not just diff hunks) and flag anti-patterns.

**Trigger:** Only run this checklist if the diff touches frontend files. Detect via:

```bash
source <(.claude/scripts/bin/meowkit-diff-scope <base> 2>/dev/null)
```

If `SCOPE_FRONTEND=false`, skip the entire design review silently.

**DESIGN.md calibration:** If `DESIGN.md` or `design-system.md` exists in the repo root, read it first. All findings are calibrated against the project's stated design system. Patterns explicitly blessed in DESIGN.md are NOT flagged. If no DESIGN.md exists, use universal design principles.

---

## Confidence Tiers

Each item is tagged with a detection confidence level:

- **[HIGH]** — Reliably detectable via grep/pattern match. Definitive findings.
- **[MEDIUM]** — Detectable via pattern aggregation or heuristic. Flag as findings but expect some noise.
- **[LOW]** — Requires understanding visual intent. Present as: "Possible issue — verify visually."

---

## Classification

**AUTO-FIX** (mechanical CSS fixes only — HIGH confidence, no design judgment needed):

- `outline: none` without replacement → add `outline: revert` or `&:focus-visible { outline: 2px solid currentColor; }`
- `!important` in new CSS → remove and fix specificity
- `font-size` < 16px on body text → bump to 16px

**ASK** (everything else — requires design judgment):

- AI slop findings, typography structure, spacing choices, interaction state gaps, DESIGN.md violations, strategic omissions

**LOW confidence items** → present as "Possible: [description]. Verify visually." Never AUTO-FIX.

---

## Output Format

```
Design Review: N issues (X auto-fixable, Y need input, Z possible)

**AUTO-FIXED:**
- [file:line] Problem → fix applied

**NEEDS INPUT:**
- [file:line] Problem description
  Recommended fix: suggested fix

**POSSIBLE (verify visually):**
- [file:line] Possible issue — verify visually
```

If no issues found: `Design Review: No issues found.`
If no frontend files changed: skip silently, no output.

---

## Categories

### 1. AI Slop Detection (9 items) — highest priority

Telltale signs of AI-generated UI. Anti-template policy: don't ship generic template-looking UI.

- **[MEDIUM]** Purple/violet/indigo gradient backgrounds or blue-to-purple color schemes. Look for `linear-gradient` with values in the `#6366f1`–`#8b5cf6` range, or CSS custom properties resolving to purple/violet.

- **[LOW]** The 3-column feature grid: icon-in-colored-circle + bold title + 2-line description, repeated 3x symmetrically. Look for a grid/flex container with exactly 3 children each containing a circular element + heading + paragraph.

- **[LOW]** Icons in colored circles as section decoration. Elements with `border-radius: 50%` + a background color used as decorative containers for icons.

- **[HIGH]** Centered-everything: `text-align: center` density. Grep for `text-align: center` — if >60% of text containers use center alignment, flag it.

- **[MEDIUM]** Uniform bubbly border-radius on every element: same large radius (16px+) applied to cards, buttons, inputs, containers uniformly. Aggregate `border-radius` values — if >80% use the same value ≥16px, flag it.

- **[MEDIUM]** Generic hero copy: "Welcome to [X]", "Unlock the power of...", "Your all-in-one solution for...", "Revolutionize your...", "Streamline your workflow". Grep HTML/JSX content for these patterns.

- **[LOW]** Dashboard-by-numbers layout: sidebar + cards + charts with no point of view. Look for layouts matching default shadcn/Tailwind dashboard templates without semantic hierarchy.

- **[MEDIUM]** Safe gray-on-white + one decorative accent color. Count distinct colors in palette. If <3 colors in use AND one is a single saturated accent, flag as undifferentiated.

- **[LOW]** Flat layouts with zero depth: no shadows, no overlap, no layering. Check for absence of `box-shadow`, `transform`, or z-index usage across the diff.

### 2. Typography (4 items)

- **[HIGH]** Body text `font-size` < 16px. Grep for `font-size` declarations on `body`, `p`, `.text`, or base styles. Values below 16px (or 1rem when base is 16px) are flagged.

- **[HIGH]** More than 3 font families introduced in the diff. Count distinct `font-family` declarations. Flag if >3 unique families appear across changed files.

- **[HIGH]** Heading hierarchy skipping levels: `h1` followed by `h3` without an `h2` in the same file/component. Check HTML/JSX for heading tags.

- **[HIGH]** Blacklisted fonts: Papyrus, Comic Sans, Lobster, Impact, Jokerman. Grep `font-family` for these names.

### 3. Spacing & Layout (5 items)

- **[MEDIUM]** Arbitrary spacing values not on a 4px or 8px scale, when DESIGN.md specifies a spacing scale. Check `margin`, `padding`, `gap` against the stated scale. Only flag when DESIGN.md defines one.

- **[MEDIUM]** Fixed widths without responsive handling: `width: NNNpx` on containers without `max-width` or `@media` breakpoints. Horizontal scroll risk on mobile.

- **[MEDIUM]** Missing `max-width` on text containers: body text or paragraph containers with no `max-width`, allowing lines >75 characters.

- **[HIGH]** `!important` in new CSS rules. Grep for `!important` in added lines. Almost always a specificity escape hatch that should be fixed properly.

- **[HIGH]** `height: 100vh` or `h-screen` (Tailwind). Breaks on mobile Safari with dynamic toolbars. Replace with `min-height: 100dvh`.

### 4. Interaction States (3 items)

- **[MEDIUM]** Interactive elements (buttons, links, inputs) missing hover/focus states. Check if `:hover` and `:focus` / `:focus-visible` pseudo-classes exist for new interactive element styles.

- **[HIGH]** `outline: none` or `outline: 0` without a replacement focus indicator. Grep for `outline:\s*(none|0)`. Removes keyboard accessibility.

- **[LOW]** Touch targets < 44px on interactive elements. Check `min-height`/`min-width`/`padding` on buttons and links. Requires computing effective size from multiple properties — low confidence from code alone.

### 5. DESIGN.md Violations (3 items, conditional)

Only apply if `DESIGN.md` or `design-system.md` exists:

- **[MEDIUM]** Colors not in the stated palette. Compare color values in changed CSS against DESIGN.md palette.

- **[MEDIUM]** Fonts not in the stated typography section. Compare `font-family` values against DESIGN.md font list.

- **[MEDIUM]** Spacing values outside the stated scale. Compare `margin`/`padding`/`gap` against DESIGN.md spacing scale.

### 6. Strategic Omissions (7 items) — what AI typically forgets

Rarely present in AI-generated output. Check explicitly on pages/routes introduced by the diff:

- **[MEDIUM]** No legal links in footer (privacy policy + terms of service). Grep footer/layout files for "privacy" / "terms" anchors.

- **[MEDIUM]** No "back" navigation on multi-step flows or detail pages. Look for breadcrumb / back-button patterns on non-root pages.

- **[LOW]** No custom 404 page. Check for `not-found.tsx`, `404.html`, or framework-specific 404 route. Absent = default browser 404.

- **[MEDIUM]** No form validation: grep new forms for `required`, `pattern`, `minLength`, or JS validation handlers. Absent on inputs → no client-side validation.

- **[HIGH]** No "skip to content" link at top of page layouts. Grep for `skip-to-content`, `skip-link`, or `href="#main"` patterns. Essential for keyboard users.

- **[HIGH]** No favicon. Check `<head>` / manifest for `icon`, `apple-touch-icon`, or Next.js `favicon.ico`. Absent = generic browser tab.

- **[MEDIUM]** No social sharing meta: `og:image`, `og:title`, `twitter:card`. Grep head / metadata for these tags.

---

## Fix Priority Order

When multiple issues are found, apply in this order for maximum impact with minimum risk:

1. **`outline: none` / focus indicator gaps** — accessibility regression, auto-fixable
2. **`!important` removal** — specificity-debt fix, small scope
3. **Typography basics** — body-text <16px, heading-level skips, blacklisted fonts
4. **Interaction states** — hover/focus on buttons/links (quick CSS additions)
5. **Strategic omissions** — skip-to-content link, favicon, og:image (templates → one-time add)
6. **AI slop patterns** — color/gradient palette cleanup, uniform radius differentiation (needs design judgment)
7. **Strategic layout work** — grid composition, max-width constraints, breaking symmetry (largest scope)

Don't block shipping on items 5-7 alone unless they violate DESIGN.md.

---

## Suppressions

Do NOT flag:

- Patterns explicitly documented in DESIGN.md as intentional choices
- Third-party/vendor CSS (node_modules, vendor directories)
- CSS resets or normalize stylesheets
- Test fixture files
- Generated/minified CSS
- Storybook stories (isolated component playgrounds, not shipped UI)
- Email templates (HTML-email constraints differ from web UI)
