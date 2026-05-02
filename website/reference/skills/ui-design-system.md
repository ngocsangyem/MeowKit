---
title: "mk:ui-design-system"
description: "Data-driven design intelligence — 160 palettes, 73 font pairings, 161 product types, 98 UX guidelines, WCAG 2.1 AA quality checklists."
---

# mk:ui-design-system

Data-driven design intelligence: curated palettes, font pairings, product recommendations, UX guidelines, accessibility standards, and quality checklists.

## What This Skill Does

Provides a comprehensive design intelligence system backed by data — not opinion. Uses 5 CSV data files (160+ color palettes, 73 font pairings, 161 product types, 98 UX guidelines, 25 chart types) to make evidence-based design decisions. Enforces WCAG 2.1 AA compliance through automated quality checklists.

## When to Use

- Creating or reviewing UI components
- Setting up a design system for a new project
- Checking WCAG accessibility compliance
- Selecting color palettes, typography, or UI styles
- Choosing chart types for data visualization
- Responsive design review
- Product-type-specific design direction

**Auto-activates** when `ui-ux-designer` agent is working.

**Explicit:** `/mk:ui-design-system [concern]`

## Core Capabilities

- **Color palettes** — 161 WCAG-verified palettes filtered by product type with hex values
- **Font pairings** — 73 pairings with mood, Google Fonts URLs, and Tailwind config snippets
- **Product direction** — 161 product types with recommended styles, landing patterns, and color focus
- **UX guidelines** — 98 Do/Don't rules across 15 categories with severity ratings
- **Chart selection** — 25 chart types with data-type matching and accessibility grades
- **Design patterns** — 8 style categories (minimalism, glassmorphism, neumorphism, brutalism, etc.)
- **Accessibility** — WCAG 2.1 AA standards for contrast, touch targets, keyboard nav, screen readers
- **Quality checklist** — visual, responsive, accessibility, performance, and interaction gates

## Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `concern` | string | Optional. Focus area: palette, typography, product, ux, charts, accessibility, review |

## Workflow

Loaded by `ui-ux-designer` agent during **Phase 3 (Build)**. Also used by `developer` agent for frontend work.

### Process

1. **Understand requirements** — what product type? audience? style direction?
2. **Look up design data** — read `references/data-lookup.md` for how to query:
   - Color palette -> `assets/colors.csv` (161 WCAG-verified palettes by product type)
   - Font pairing -> `assets/typography.csv` (73 pairings with Google Fonts URLs)
   - Product direction -> `assets/products.csv` (161 types with style/dashboard/color recs)
   - UX check -> `assets/ux-guidelines.csv` (98 Do/Don't rules with severity)
   - Chart type -> `assets/charts.csv` (25 types with accessibility grades)
3. **Apply design rules** — load from references/ based on task:
   - Visual design -> `references/design-patterns.md`
   - Accessibility -> `references/accessibility-standards.md`
   - Quality check -> `references/quality-checklist.md`
4. **Validate** — run quality-checklist.md before handoff

## Data Assets

| File | Rows | Content |
|------|------|---------|
| `assets/colors.csv` | 160 | WCAG-verified palettes by product type (hex values) |
| `assets/typography.csv` | 73 | Font pairings with mood, Google Fonts URLs, Tailwind config |
| `assets/products.csv` | 161 | Product type -> style, landing pattern, dashboard, color focus |
| `assets/ux-guidelines.csv` | 98 | Do/Don't pairs with category + severity |
| `assets/charts.csv` | 25 | Data type -> best chart, accessibility grade, library |

### Lookup Priority

1. **Start with products.csv** — get overall design direction
2. **Then colors.csv** — get specific hex values
3. **Then typography.csv** — get font stack
4. **Then ux-guidelines.csv** — verify against common mistakes
5. **charts.csv** — only if data visualization needed

### Example Lookups

```
"Need colors for a fintech dashboard"
-> Filter colors.csv rows where product type contains "fintech"
-> Get: #F59E0B gold primary + #8B5CF6 purple accent

"Need fonts for a tech startup landing page"
-> Filter typography.csv where mood contains "bold" or "innovative"
-> Get: Space Grotesk (heading) + DM Sans (body)
-> Copy the Google Fonts URL and Tailwind config

"Building a mental health app"
-> Read products.csv, find "mental health" row
-> Get: calming style, lavender palette, soft animations, accessibility-first

"Need to show trends over time"
-> Read charts.csv, find "time series" or "trend"
-> Get: Line chart (primary), Area chart (secondary), use Recharts or D3
```

## Design Patterns

### Style Categories

| Style | Key Traits | Best For |
|-------|-----------|----------|
| Minimalism | White space, limited palette, thin typography | SaaS, portfolios, docs |
| Glassmorphism | Frosted glass, blur, transparency, subtle borders | Dashboards, modals, cards |
| Neumorphism | Soft shadows, extruded/inset, monochrome base | Settings panels, controls |
| Brutalism | Raw, bold type, harsh colors, exposed structure | Creative agencies, portfolios |
| Bento Grid | Card-based grid, mixed sizes, clean gaps | Feature showcases, dashboards |
| Dark Mode | Dark backgrounds, high-contrast accents, reduced blue light | Dev tools, media, productivity |
| Flat Design | No shadows, solid colors, simple shapes | Mobile apps, icons, infographics |
| Skeuomorphism | Real-world textures, depth, realistic elements | Games, music apps, niche tools |

### Color Palette by Product Type

| Product Type | Primary Direction | Accent Direction |
|-------------|-------------------|------------------|
| SaaS / Business | Blue, Indigo | Green for success, Orange for CTA |
| E-commerce | Brand-specific | Red/Orange for urgency, Green for trust |
| Healthcare | Teal, Blue | Soft green for positive, warm gray for neutral |
| Finance | Navy, Dark blue | Gold/amber for premium, green for growth |
| Creative / Portfolio | Flexible — match brand personality | High-contrast accent |
| Developer tools | Dark bg, cool grays | Cyan/green for syntax, warm for warnings |

### Typography Principles

- **Heading + Body**: contrast weight/style (e.g., bold geometric heading + regular humanist body)
- **Max 2 families**: one for headings, one for body. More = visual noise
- **Scale**: use a modular scale (1.25 or 1.333 ratio) for consistent hierarchy
- **Line height**: 1.5-1.75 for body text, 1.1-1.3 for headings
- **Line length**: 65-75 characters for readability

## Accessibility Standards (WCAG 2.1 AA)

### Color Contrast

| Element | Minimum Ratio |
|---------|:---:|
| Normal text (<18px) | 4.5:1 |
| Large text (>=18px or >=14px bold) | 3:1 |
| UI components & graphical objects | 3:1 |
| Decorative elements | No requirement |

**Rule:** Never use color alone to communicate information. Always pair with icon, text, or pattern.

### Touch Targets

| Element | Minimum Size | Minimum Spacing |
|---------|:---:|:---:|
| Buttons, links, controls | 44x44px | 8px gap |
| Icon-only buttons | 48x48px | 8px |
| Form inputs | 44px height | - |

### Keyboard Navigation

- All interactive elements reachable via Tab
- Visible focus indicator (2px+ outline, 3:1 contrast)
- Escape closes modals/dropdowns
- Arrow keys navigate within groups (tabs, menus, lists)
- No keyboard traps (can always Tab out)

### Screen Readers

- All images: meaningful `alt` text or `aria-hidden="true"` for decorative
- Heading hierarchy: h1 -> h2 -> h3 (no skipping levels)
- Form inputs: associated `<label>` or `aria-label`
- ARIA landmarks: `<main>`, `<nav>`, `<aside>`, `<footer>`
- Dynamic content: `aria-live="polite"` for updates

### Motion & Animation

- Respect `prefers-reduced-motion` — disable non-essential animations
- Animation duration: 150-300ms for micro-interactions
- No auto-playing video/audio without user control
- Loading spinners: include `aria-busy="true"` on container

### Forms

- Error messages adjacent to field (not just top of form)
- Required fields: visual indicator + `aria-required="true"`
- Inline validation on blur (not keystroke)
- Clear error recovery path (what went wrong + how to fix)

## Quality Checklist

Run through before any design handoff. All items must pass.

### Visual Quality
- [ ] No emoji used as icons — use SVG or icon library
- [ ] Consistent spacing (8px rhythm: 8, 16, 24, 32, 48)
- [ ] Color palette limited to 1 primary + 1 accent + neutrals
- [ ] Typography uses max 2 font families
- [ ] All interactive elements have hover, active, focus, disabled states
- [ ] Dark mode: backgrounds use true dark (not pure black), text has sufficient contrast

### Responsive
- [ ] Works at 320px width (no horizontal scroll)
- [ ] Touch targets >= 44x44px on mobile
- [ ] Navigation collapses to hamburger/bottom nav on mobile
- [ ] Images scale without distortion
- [ ] Tables scroll horizontally or restructure on mobile

### Accessibility
- [ ] Color contrast passes WCAG 2.1 AA (4.5:1 normal, 3:1 large)
- [ ] All images have alt text (or aria-hidden for decorative)
- [ ] Keyboard navigation works for all interactive elements
- [ ] Focus indicators visible (2px+ outline)
- [ ] Form fields have labels
- [ ] Error messages are descriptive and adjacent to field

### Performance
- [ ] Images optimized (WebP/AVIF, appropriate dimensions)
- [ ] Fonts loaded with `font-display: swap`
- [ ] No layout shift from loading content (CLS < 0.1)
- [ ] Critical CSS inlined or preloaded
- [ ] Lazy load below-fold images

### Interaction
- [ ] Loading states for async actions (spinners, skeletons)
- [ ] Empty states designed (not just blank screens)
- [ ] Error states have recovery path
- [ ] Success feedback for completed actions (toast, checkmark)
- [ ] Confirmation for destructive actions (delete, discard)

## Gotchas

- **Aesthetic over accessibility**: beautiful design that fails WCAG — check contrast (4.5:1 normal, 3:1 large) before shipping
- **Desktop-first design**: designing for large screens then cramming into mobile — start from 320px
- **Color-only communication**: red/green for status — pair with icon or text label
- **Ignoring the data**: guessing palette when colors.csv has WCAG-verified values — always look up first
- **Generic product assumptions**: all SaaS looks the same — check products.csv for product-specific recommendations

## Common Use Cases

- Bootstrapping a design system for a new SaaS product
- Auditing an existing UI for WCAG 2.1 AA compliance
- Selecting a color palette and font pairing based on product type
- Reviewing UX patterns against 98 established guidelines
- Choosing the right chart type for dashboard data visualization
- Running the quality checklist before production deployment

## Example Prompt

> /mk:ui-design-system palette
> I'm building a fintech dashboard. Based on the data assets, what color palette, font pairing, and UX patterns do you recommend? Pull from colors.csv and typography.csv for WCAG-verified combinations.

## Pro Tips

- Always start with products.csv for overall direction — it informs all other decisions
- Every palette in colors.csv is WCAG-verified — no need to manually check contrast for recommended combinations
- Use the UX guidelines CSV to catch mistakes before they reach review
- The quality checklist is your last gate — nothing ships without all checkboxes marked
- Filter ux-guidelines.csv by severity first (CRITICAL -> HIGH -> MEDIUM) for efficient reviews
