---
name: mk:ui-design-system
version: 2.0.0
description: "UI components, design systems, WCAG. NOT for mk:frontend-design."
allowed-tools:
  - Read
  - Grep
  - Glob
  - WebSearch
  - AskUserQuestion
source: local
keywords:
  - ui-design-system
  - color-palette
  - font-pairing
  - wcag
  - accessibility-audit
  - responsive-design
when_to_use: "Palette or contrast."
user-invocable: true
owner: utility
criticality: medium
status: active
runtime: claude-code
---

# UI Design System

Data and numeric standards for UI work: curated palettes, font pairings, product-type recommendations, UX guidelines, chart choices, and the one set of spacing, breakpoint, contrast, touch-target and motion values every UI skill points to.

## When to Use

- Choosing a palette, font pairing, chart type or overall style direction for a product
- Setting up a design system for a new project
- Checking contrast, touch targets, spacing, breakpoints or motion timing against the standard values
- Reviewing responsive behaviour

Not for critiquing or implementing a specific screen (`mk:frontend-design` owns slop judgment and implementation). For a Figma link use `mk:figma`; for generated screens use `mk:stitch`. Those three feed `mk:frontend-design`; this skill supplies the data and numbers they cite.

## Process

1. **Understand the need.** Product type, audience, style direction. A small patch (one colour, one spacing fix) needs only step 3.
2. **Look up data, do not read whole files.** The CSVs are wide, so search by product type and read the matching rows only. `references/data-lookup.md` has the columns and examples. Example:
   `grep -i "fintech" assets/colors.csv`
   Files: `assets/colors.csv` (palettes), `assets/typography.csv` (pairings with Google Fonts URLs), `assets/products.csv` (product type to style), `assets/ux-guidelines.csv` (Do/Don't rules), `assets/charts.csv` (data type to chart).
3. **Apply the standard values** from `references/`:
   - contrast, touch targets, keyboard, motion: `accessibility-standards.md`
   - spacing, breakpoints, type scale, dark mode, style categories: `design-patterns.md`
4. **Hand off.** `references/quality-checklist.md` is a handoff aid: walk all of it for a new component or a design system, and only the groups the change touched for a patch.

## Gotchas

- **Aesthetic over accessibility**: a design that fails contrast is not done; check the ratios in `accessibility-standards.md` before shipping.
- **Desktop-first design**: crammed mobile layouts; start from 320px wide.
- **Color-only communication**: red/green for status; pair with an icon or text label.
- **Guessing a palette** when `colors.csv` has verified values: look up first.
- **Generic product assumptions**: all SaaS looks the same; check `products.csv` for the product type.
