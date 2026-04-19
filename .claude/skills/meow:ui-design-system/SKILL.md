---
name: meow:ui-design-system
version: 2.0.0
description: |
  Use when designing UI components, creating design systems, reviewing visual design,
  or checking accessibility compliance. Triggers on "design system", "UI review",
  "color palette", "font pairing", "accessibility audit", "responsive design",
  "WCAG check". Auto-activates when ui-ux-designer agent is working.
  Data-driven: 161 palettes, 73 font pairings, 161 product types, 99 UX guidelines, 25 chart types.
allowed-tools:
  - Read
  - Grep
  - Glob
  - WebSearch
  - AskUserQuestion
sources:
  - claudekit-engineer/ui-ux-pro-max
  - claudekit-engineer/web-design-guidelines
---

# UI Design System

Data-driven design intelligence: curated palettes, font pairings, product recommendations, UX guidelines, accessibility standards, and quality checklists.

## When to Use

- Creating or reviewing UI components
- Setting up a design system for a new project
- Checking WCAG accessibility compliance
- Selecting color palettes, typography, or UI styles
- Choosing chart types for data visualization
- Responsive design review

## Process

1. **Understand requirements** — what product type? audience? style direction?
2. **Look up design data** — read `references/data-lookup.md` for how to query:
   - Color palette → `assets/colors.csv` (161 WCAG-verified palettes by product type)
   - Font pairing → `assets/typography.csv` (73 pairings with Google Fonts URLs)
   - Product direction → `assets/products.csv` (161 types with style/dashboard/color recs)
   - UX check → `assets/ux-guidelines.csv` (99 Do/Don't rules with severity)
   - Chart type → `assets/charts.csv` (25 types with accessibility grades)
3. **Apply design rules** — load from references/ based on task:
   - Visual design → `references/design-patterns.md`
   - Accessibility → `references/accessibility-standards.md`
   - Quality check → `references/quality-checklist.md`
4. **Validate** — run quality-checklist.md before handoff

## Data Assets (NEW — v2.0)

| File | Rows | Content |
|------|------|---------|
| `assets/colors.csv` | 161 | WCAG-verified palettes by product type (hex values) |
| `assets/typography.csv` | 73 | Font pairings with mood, Google Fonts URLs, Tailwind config |
| `assets/products.csv` | 161 | Product type → style, landing pattern, dashboard, color focus |
| `assets/ux-guidelines.csv` | 99 | Do/Don't pairs with category + severity |
| `assets/charts.csv` | 25 | Data type → best chart, accessibility grade, library |

See `references/data-lookup.md` for lookup patterns and examples.

## Gotchas

- **Aesthetic over accessibility**: beautiful design that fails WCAG → check contrast (4.5:1 normal, 3:1 large) before shipping
- **Desktop-first design**: designing for large screens then cramming into mobile → start from 320px
- **Color-only communication**: red/green for status → pair with icon or text label
- **Ignoring the data**: guessing palette when colors.csv has WCAG-verified values → always look up first
- **Generic product assumptions**: all SaaS looks the same → check products.csv for product-specific recommendations

## Workflow Integration

Loaded by `ui-ux-designer` agent during Phase 3 (Build). Also used by `developer` agent for frontend work.
