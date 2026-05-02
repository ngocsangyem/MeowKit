---
title: "mk:frontend-design"
description: "Production-grade UI/UX design — anti-AI-slop enforcement, WCAG 2.1 AA accessibility, typography, color, motion, responsive. Design tokens and visual quality."
---

# mk:frontend-design

Production-grade UI/UX design with anti-AI-slop enforcement. Covers aesthetics, accessibility, typography, color, motion, responsive, and design tokens.

## What This Skill Does

Ensures every UI output is polished, accessible, and distinguishable from generic AI-generated design. Enforces design principles, typography hierarchy, color systems, spacing scales, motion rules, and WCAG 2.1 AA compliance. The anti-slop checklist prevents common AI-design cliches.

## When to Use

**Auto-activate on:** Design tasks, UI component styling, "make it look good", "improve the design", "fix the UI", "design review", design system work, CSS/styling changes.

**Explicit:** `/mk:frontend-design [concern]`

**Do NOT invoke for:** Vue patterns (use `mk:vue`), TypeScript (use `mk:typescript`), backend code, API integration.

## Core Capabilities

- **Typography** — hierarchy (display/heading/subhead/body/caption), intentional font pairing, weight selection
- **Color** — primary + accent + neutral palette structure, semantic colors, WCAG contrast ratios, dark mode
- **Spacing** — 4px base scale, component vs section spacing, varied whitespace
- **Motion** — purposeful animation timing, prefers-reduced-motion, state transitions
- **Responsive** — mobile-first, touch targets, breakpoints, thumb-zone navigation
- **Accessibility** — WCAG 2.1 AA, keyboard navigation, screen readers, focus indicators
- **Anti-Slop** — detection and correction of generic AI-generated UI patterns

## Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `concern` | string | Optional. Focus area: typography, color, spacing, motion, responsive, accessibility, review |

## Workflow

Operates in **Phase 3 (Build GREEN)** and **Phase 4 (Review)** for design quality checks. Output supports the `developer` agent (Phase 3) or `reviewer` agent (Phase 4).

### Process

1. **Analyze** — detect task type (new component, redesign, review, responsive fix), load relevant design rules from `references/design-rules.md` and `references/anti-slop-directives.md`
2. **Implement** — apply typography, color, spacing, motion per rules. Run anti-slop checklist. Ensure WCAG 2.1 AA accessibility.
3. **Verify** — run pre-delivery checklist before presenting to user

## Design Principles (always apply)

1. **Typography first** — choose typeface before colors or layout
2. **Whitespace is design** — generous spacing signals quality
3. **Color with purpose** — every color must have a semantic role
4. **Motion earns attention** — animate only to communicate state change
5. **Accessibility is default** — 4.5:1 contrast, keyboard nav, screen readers

## Anti-AI-Slop Checklist (MANDATORY before delivery)

Every design output MUST pass these checks:

### Typography
| Anti-Pattern (NEVER) | Do Instead |
|----------------------|------------|
| System font stack only, single weight | 2-3 weights, intentional font pairing (use `mk:ui-design-system/assets/typography.csv`) |
| All text same size/weight | Clear hierarchy: display -> heading -> body -> caption |
| Inter as default font | Choose font from typography.csv matching project mood |

### Color
| Anti-Pattern (NEVER) | Do Instead |
|----------------------|------------|
| Pure black (#000) on pure white (#fff) | Softened: #111827 on #fafafa or similar |
| Rainbow of unrelated colors | 1 primary + 1 accent + neutrals (use `mk:ui-design-system/assets/colors.csv`) |
| Purple gradient as hero background | Use brand-appropriate gradient or solid color |

### Layout
| Anti-Pattern (NEVER) | Do Instead |
|----------------------|------------|
| Centered everything, card grid with equal spacing | Asymmetric layouts, intentional whitespace variation |
| Default padding/margin everywhere | Design tokens: consistent spacing scale (4px base) |
| 3-column equal card grid | Vary card sizes, use bento grid, or 2-column with feature highlight |

### Content
| Anti-Pattern (NEVER) | Do Instead |
|----------------------|------------|
| "Lorem ipsum" in final delivery | Real or realistic content |
| "John Doe", "jane@example.com" placeholders | Diverse, realistic names and data |

### Effects
| Anti-Pattern (NEVER) | Do Instead |
|----------------------|------------|
| Gratuitous shadows, gradients, blur | Subtle shadows (0 1px 3px), purposeful gradients |
| Parallax on every section | Reserve motion for hero or key CTA; respect prefers-reduced-motion |

### Components
| Anti-Pattern (NEVER) | Do Instead |
|----------------------|------------|
| Default browser inputs/buttons | Styled components with clear states (hover, focus, disabled) |
| Unstyled select/checkbox/radio | Custom-styled form controls with accessibility preserved |

### Visual Assets
| Anti-Pattern (NEVER) | Do Instead |
|----------------------|------------|
| Emoji as functional icons | SVG icons from consistent library (Lucide, Heroicons, Phosphor) |
| Stock photo hero banners | Custom illustrations, product screenshots, or abstract art |

### Performance
| Anti-Pattern (NEVER) | Do Instead |
|----------------------|------------|
| Unoptimized images, layout shift | Next-gen formats (WebP/AVIF), explicit dimensions, skeleton loaders |

### Dark Mode
| Anti-Pattern (NEVER) | Do Instead |
|----------------------|------------|
| Just invert colors | Separate dark palette with reduced brightness, maintain contrast ratios |

### Branding
| Anti-Pattern (NEVER) | Do Instead |
|----------------------|------------|
| "Built with love by the X team" footer | Real content or nothing |
| Product name = literal description (KanbanApp) | Distinctive naming |
| Default or missing favicon | Distinct favicon |

## Design Rules

### Typography

**Hierarchy (from largest to smallest):**
```
Display:  2.5-4rem,  font-weight 700-900, tracking tight
Heading:  1.5-2.5rem, font-weight 600-700
Subhead:  1.125-1.5rem, font-weight 500-600
Body:     1rem (16px), font-weight 400, line-height 1.5-1.75
Caption:  0.75-0.875rem, font-weight 400, muted color
```

**Anti-Patterns:**
- All text same size — must have 3+ distinct sizes
- Font weight only 400 — use at least 400, 500, and 700
- Line height < 1.4 for body text — minimum 1.5

### Color

**Palette Structure:**
```
Primary:  1 color (brand identity, CTAs)
Accent:   1 color (highlights, interactive states)
Neutral:  3-5 shades (gray-50 to gray-900 for text/bg)
Semantic: success (#22c55e), warning (#f59e0b), error (#ef4444), info (#3b82f6)
```

**Rules:**
- Maximum 5 distinct hue families in any design
- Text color: #111827 (gray-900) not #000
- Background: #fafafa or #f9fafb not #fff
- Contrast: WCAG AA minimum (4.5:1 text, 3:1 large text)
- Dark mode: invert neutrals, reduce saturation by 10-15%

### Spacing

**Scale (4px base):**
```
0: 0px     1: 4px     2: 8px     3: 12px
4: 16px    5: 20px    6: 24px    8: 32px
10: 40px   12: 48px   16: 64px   20: 80px
```

**Rules:**
- Use scale values only — no arbitrary numbers
- Component internal padding: 12-24px (3-6 units)
- Section spacing: 48-80px (12-20 units)
- Never use same spacing everywhere — vary for hierarchy

### Motion

**When to Animate:** state transitions (hover, focus, active), enter/exit (mount/unmount), feedback (success, error, loading)

**When NOT to Animate:** static content display, already-visible elements on scroll, purely decorative motion

**Timing:**
```
Micro:    100-200ms (hover, focus, toggle)
Standard: 200-300ms (panel open, navigation)
Complex:  300-500ms (page transition, modal)
Easing:   ease-out for enter, ease-in for exit
```

### Responsive

**Breakpoints (Tailwind convention):**
```
sm:  640px   (mobile landscape)
md:  768px   (tablet portrait)
lg:  1024px  (tablet landscape / small desktop)
xl:  1280px  (desktop)
2xl: 1536px  (large desktop)
```

**Mobile-First Rules:**
- Design mobile layout first, then expand
- Touch targets: minimum 44x44px
- Text: minimum 16px on mobile
- Test: thumb reach zone (bottom-center is prime real estate)

### Accessibility (WCAG 2.1 AA)

**Required:**
- Color contrast: 4.5:1 (normal text), 3:1 (large text >=18px bold or >=24px)
- Keyboard navigation: all interactive elements focusable
- Focus indicators: visible, high contrast ring
- Screen reader: all images have alt text, forms have labels
- Reduced motion: respect `prefers-reduced-motion` media query

## Anti-Slop Directives

Patterns that mark AI-generated UI as generic and forgettable:

| Pattern (Avoid) | Why It's Slop | Use Instead |
|----------------|---------------|-------------|
| Generic gradient (`#667eea -> #764ba2`) | Appears in thousands of AI UIs | Specific palette from colors.csv matched to product tone |
| Excessive rounded corners (24px+ on everything) | No intentional design decision | Intentional corner radius scale: sharp for data, rounded for consumer |
| "Welcome to [App Name]" hero | Zero specificity | Specific value proposition |
| Default MUI/Shadcn themes | No design identity | Override at minimum: primary color, font, border radius, shadow scale |
| Placeholder images | Incomplete design | Real screenshots, product captures, or abstract geometric art |
| Equal-height card grid | Default layout | Asymmetric layouts, bento grids, varied card weights |
| SVG filler patterns | Visually busy, semantically empty | Purposeful whitespace or single domain-tied illustration |

### The Identity Test

Before delivery, remove the logo and brand name. Could this be any other app in the same category? If yes — it's slop. Add one specific, opinionated design decision that makes this design belong only to this product.

## Output Format

```
## Design: {component or page}

**Type:** {new design | redesign | review | responsive fix}
**Framework:** {Vue | React | vanilla CSS}

### Design Decisions
{numbered list of design choices with reasoning}

### Anti-Slop Check
{checkmark/X per category from checklist}

### Accessibility
- Contrast ratio: {value} (min 4.5:1)
- Keyboard navigable: {yes/no}
- Screen reader labels: {present/missing}

### Files Modified
{list of CSS/component files}
```

## Failure Handling

| Failure | Recovery |
|---------|----------|
| No design system in project | Apply sensible defaults (neutral palette, system fonts with fallbacks) |
| Contrast ratio below 4.5:1 | Adjust colors — never ship inaccessible UI |
| Anti-slop check fails | Fix failing items before delivery |

## Gotchas

- **Tailwind dynamic class names are purged in production** — classes via string interpolation (`text-${size}-bold`) are not detected by Tailwind's content scanner; use complete class strings or add to `safelist`.
- **shadcn/ui component tokens drift from project's CSS variables** — shadcn references `--primary`, `--card`, `--muted` etc.; if project uses different variable names (e.g. `--brand-primary`), components render with wrong colors; audit `globals.css` token names after every shadcn `add`.
- **Figma color token names don't map 1:1 to CSS custom properties** — `Colors/Brand/Primary` exports as `colors-brand-primary` but shadcn/Tailwind expect `--primary`; manually map or configure the transformer.
- **Dark mode token gaps produce transparent/invisible elements** — adding `dark:` variant without defining the CSS variable in `.dark` scope makes the element transparent (variable resolves to empty); verify every light-mode token has an explicit dark-mode override.
- **Default Tailwind breakpoints differ from design system breakpoints** — Tailwind's `md: 768px` clashes with some designs using `md: 960px`; override breakpoints in `tailwind.config.js` before implementing responsive styles.
- **SVG icon libraries ship multiple bundle formats** — importing `lucide-react` icons in a Vue project (instead of `lucide-vue-next`) compiles without error but icons render empty; always verify the framework-specific package is used.

## References

| Reference | When to load | Content |
|-----------|-------------|---------|
| `references/design-rules.md` | Steps 2-3 | Typography, color, spacing, motion, responsive rules |
| `references/anti-slop-directives.md` | During UI implementation | 7 generic patterns to avoid + positive alternatives + identity test |

## Common Use Cases

- Creating a new UI component from scratch
- Reviewing an existing design for AI-slop patterns
- Setting up a project's design tokens and CSS variables
- Ensuring WCAG 2.1 AA compliance
- Fixing visual consistency issues across a codebase
- Designing responsive layouts for mobile-first

## Example Prompt

> /mk:frontend-design
> I'm building a SaaS dashboard landing page. Make it look professional and not like generic AI-generated design — I want it to pass the identity test and use a distinctive palette from the design system.

## Pro Tips

- Always pass the Identity Test before delivery
- Choose typography first, then colors, then layout
- Use the spacing scale exclusively — never arbitrary pixel values
- Run Lighthouse accessibility audit on every page
- For shadcn/ui projects, audit CSS variable names after every component addition
- Verify dark mode tokens exist for every light-mode variable used
