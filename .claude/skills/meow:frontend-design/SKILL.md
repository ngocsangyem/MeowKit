---
name: meow:frontend-design
description: "Use when designing UI components, reviewing visual design, building design systems, or checking accessibility. Auto-activates on frontend design tasks and UI reviews."
source: claudekit-engineer
original_skills: [ui-ux-pro-max, frontend-design]
adapted_for: meowkit
---

# Frontend Design

Production-grade UI/UX design with anti-AI-slop enforcement. Covers aesthetics, accessibility, typography, color, motion, responsive, and design tokens.

## When to Invoke

**Auto-activate on:** Design tasks, UI component styling, "make it look good", "improve the design", "fix the UI", "design review", design system work, CSS/styling changes

**Explicit:** `/meow:frontend-design [concern]`

**Do NOT invoke for:** Vue patterns (use meow:vue), TypeScript (use meow:typescript), backend code, API integration

## Workflow Integration

Operates in **Phase 3 (Build GREEN)** and **Phase 4 (Review)** for design quality checks. Output supports the `developer` agent (Phase 3) or `reviewer` agent (Phase 4).

## Process

1. **Analyze** — detect task type (new component, redesign, review, responsive fix), load relevant design rules from `references/design-rules.md`
2. **Implement** — apply typography, color, spacing, motion per rules. Run anti-slop check (see checklist below). Ensure WCAG 2.1 AA accessibility.
3. **Verify** — run pre-delivery checklist before presenting to user

## Anti-AI-Slop Checklist (MANDATORY before delivery)

Every design output MUST pass these checks:

| Category | Anti-Pattern (NEVER) | Do Instead |
|----------|---------------------|------------|
| **Typography** | System font stack only, single weight | 2-3 weights, intentional font pairing (use meow:ui-design-system/assets/typography.csv) |
| **Typography** | All text same size/weight | Clear hierarchy: display → heading → body → caption |
| **Typography** | Inter as default font | Choose font from typography.csv matching project mood |
| **Color** | Pure black (#000) on pure white (#fff) | Softened: #111827 on #fafafa or similar |
| **Color** | Rainbow of unrelated colors | 1 primary + 1 accent + neutrals (use meow:ui-design-system/assets/colors.csv) |
| **Color** | Purple gradient as hero background | Use brand-appropriate gradient or solid color |
| **Layout** | Centered everything, card grid with equal spacing | Asymmetric layouts, intentional whitespace variation |
| **Layout** | Default padding/margin everywhere | Design tokens: consistent spacing scale (4px base) |
| **Layout** | 3-column equal card grid | Vary card sizes, use bento grid, or 2-column with feature highlight |
| **Content** | "Lorem ipsum" in final delivery | Real or realistic content |
| **Content** | "John Doe", "jane@example.com" placeholders | Diverse, realistic names and data |
| **Effects** | Gratuitous shadows, gradients, blur | Subtle shadows (0 1px 3px), purposeful gradients |
| **Effects** | Parallax on every section | Reserve motion for hero or key CTA; respect prefers-reduced-motion |
| **Components** | Default browser inputs/buttons | Styled components with clear states (hover, focus, disabled) |
| **Components** | Unstyled select/checkbox/radio | Custom-styled form controls with accessibility preserved |
| **Icons** | Emoji as functional icons | SVG icons from consistent library (Lucide, Heroicons, Phosphor) |
| **Images** | Stock photo hero banners | Custom illustrations, product screenshots, or abstract art |
| **Performance** | Unoptimized images, layout shift | Next-gen formats (WebP/AVIF), explicit dimensions, skeleton loaders |
| **Dark Mode** | Just invert colors | Separate dark palette with reduced brightness, maintain contrast ratios |

## Design Principles (always apply)

1. **Typography first** — choose typeface before colors or layout
2. **Whitespace is design** — generous spacing signals quality
3. **Color with purpose** — every color must have a semantic role
4. **Motion earns attention** — animate only to communicate state change
5. **Accessibility is default** — 4.5:1 contrast, keyboard nav, screen readers

## Output Format

```
## Design: {component or page}

**Type:** {new design | redesign | review | responsive fix}
**Framework:** {Vue | React | vanilla CSS}

### Design Decisions
{numbered list of design choices with reasoning}

### Anti-Slop Check
{✓/✗ per category from checklist}

### Accessibility
- Contrast ratio: {value} (min 4.5:1)
- Keyboard navigable: {yes/no}
- Screen reader labels: {present/missing}

### Files Modified
{list of CSS/component files}
```

## References

| Reference                                           | When to load | Content                                              |
| --------------------------------------------------- | ------------ | ---------------------------------------------------- |
| **[design-rules.md](./references/design-rules.md)** | Steps 2-3    | Typography, color, spacing, motion, responsive rules |
| **[anti-slop-directives.md](./references/anti-slop-directives.md)** | During UI implementation | 7 generic patterns to avoid + positive alternatives + identity test |

## Failure Handling

| Failure                     | Recovery                                                               |
| --------------------------- | ---------------------------------------------------------------------- |
| No design system in project | Apply sensible defaults (neutral palette, system fonts with fallbacks) |
| Contrast ratio below 4.5:1  | Adjust colors — never ship inaccessible UI                             |
| Anti-slop check fails       | Fix failing items before delivery                                      |

## Gotchas

- **Tailwind dynamic class names are purged in production** — classes constructed via string interpolation (`\`text-${size}-bold\``) are not detected by Tailwind's content scanner and are stripped from the production CSS bundle; use complete class strings in source or add them to the `safelist` in `tailwind.config.js`.
- **shadcn/ui component tokens drift from the project's CSS variables** — shadcn generates components that reference `--primary`, `--card`, `--muted` etc. from its own token set; if the project's design system uses different variable names (e.g. `--brand-primary`), components render with the wrong colors silently; audit `globals.css` token names against shadcn's expected token list after every shadcn `add` command.
- **Figma color token names don't map 1:1 to CSS custom properties** — a Figma token named `Colors/Brand/Primary` exports as `colors-brand-primary` in Style Dictionary but shadcn and Tailwind expect `--primary`; manually map or configure the transformer, never assume the export name matches the CSS var name.
- **Dark mode token gaps produce transparent or invisible elements** — adding a `dark:` variant class without defining the corresponding CSS variable in the `.dark` scope makes the element transparent (variable resolves to empty); always verify every token used in light mode has an explicit dark-mode override in the theme.
- **Default Tailwind breakpoints differ from common design system breakpoints** — Tailwind's `md: 768px` clashes with some design systems that use `md: 960px`; responsive layouts built from Figma specs at 960px will reflow at the wrong breakpoint; override breakpoints in `tailwind.config.js` to match the design system before implementing responsive styles.
- **SVG icon libraries ship multiple bundle formats and wrong import causes missing icons** — importing `lucide-react` icons in a Vue project (instead of `lucide-vue-next`) compiles without error but icons render as empty elements because the React component returns JSX that Vue ignores; always verify the framework-specific package is used.

## Handoff

On completion → `reviewer` agent for Phase 4 design dimension check.
