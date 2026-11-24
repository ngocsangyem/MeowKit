---
name: mk:frontend-design
description: "Designs and reviews UI, accessibility. NOT for mk:ui-design-system."
source: local
original_skills:
  - ui-ux-pro-max
  - frontend-design
adapted_for: claude-code
keywords:
  - frontend-design
  - ui-mockup
  - screenshot-replication
  - design-implementation
  - best-practices
when_to_use: "Critique a screen."
user-invocable: true
owner: utility
criticality: medium
status: active
runtime: claude-code
---

# Frontend Design

Design and review UI so it is specific to the product, accessible and consistent: typography, colour, layout, motion and responsive behaviour, with the generic "AI-made" look kept out.

## When to Use

Use for new screens, redesigns, "make it look better", design reviews and styling changes. A bug fix in one component needs the gotchas below, not a design pass.

Neighbours:
- `mk:ui-design-system` owns the data and numbers: palettes, font pairings, contrast ratios, touch targets, spacing scale, breakpoints, motion timing. Cite it instead of restating values.
- `mk:figma` turns a Figma link into code; `mk:stitch` generates screens. Both hand their output to this skill.
- Backend code and API integration are out of scope.

## Outcome

The result looks like it belongs to this product, works with keyboard and screen reader, and holds up on a phone width. Principles, in order of use:

1. **Typography first.** Choose the typeface before colour or layout; build hierarchy from size as well as weight, with two or three weights in use.
2. **Whitespace is design.** Generous, varied spacing signals quality; one spacing value everywhere signals no decision was made.
3. **Colour has a role.** One primary, one accent, neutrals; every colour earns a semantic job.
4. **Motion earns attention.** Animate state changes and feedback; respect `prefers-reduced-motion`.
5. **Accessible by default.** Contrast, focus, labels and touch targets use the values in `mk:ui-design-system`.

## Slop to avoid

The recognisable failures are a default purple-blue gradient, rounding on everything, a "Welcome to X" hero, an unthemed component library, placeholder or stock imagery, a three-column equal card grid, emoji as functional icons, and "John Doe" data. `references/anti-slop-directives.md` has the replacements and an identity test (remove the logo: could this be any app in the category?). Load it for new screens and redesigns. `references/design-rules.md` has the typography, colour, motion and mobile-first rules.

## Done check

Report what changed and why. State contrast as a measured value from a tool (a contrast checker, or Lighthouse as in the accessibility-standards reference of `mk:ui-design-system`), not a self-attested pass. If nothing could be measured, say so.

When the project has no design system, apply neutral defaults with system-font fallbacks and say that you did.

## Gotchas

- **Tailwind never sees interpolated class names.** `text-${size}-bold` is stripped from the production CSS. Write complete class strings, or force them: `safelist` in `tailwind.config.js` for v3, `@source inline(...)` in the CSS for v4.
- **Tailwind v4 is configured in CSS** (`@theme`), so breakpoints and tokens live there; v3 projects use `tailwind.config.js`. Check which the project has before editing either.
- **shadcn/ui tokens drift.** Components reference `--primary`, `--card`, `--muted`; if the project names its variables differently, colours are silently wrong. Compare `globals.css` with the generated components after each `add`.
- **Figma token names do not map 1:1 to CSS variables.** `Colors/Brand/Primary` exports as `colors-brand-primary`, while shadcn and Tailwind expect `--primary`; map them explicitly.
- **Dark mode gaps make elements transparent.** A `dark:` class whose CSS variable is not defined in the `.dark` scope resolves to empty; confirm every token has a dark override.
- **Design-system breakpoints can differ from Tailwind's** (a 960px `md` against 768px); align them before building responsive styles.
- **Icon packages are per framework.** `lucide-react` in a Vue project compiles but renders nothing; use the matching package (`lucide-vue-next`).

## Handoff

Phase 4 review of the design dimension goes to the `reviewer` agent.
