---
title: "meow:ui-design-system"
description: "Data-driven design intelligence: 161 palettes, 57 font pairings, 161 product types, 99 UX guidelines, WCAG 2.1 AA standards."
---

# meow:ui-design-system

Data-driven design intelligence: curated palettes, font pairings, product recommendations, UX guidelines, accessibility standards, and quality checklists.

## What This Skill Does

`meow:ui-design-system` provides the design knowledge that the `ui-ux-designer` agent needs. Unlike generic design rules, this skill ships with **curated CSV data** — 161 WCAG-verified color palettes, 57 pre-tested font pairings with Google Fonts URLs, 161 product type recommendations, 99 structured UX Do/Don't guidelines, and 25 chart type recommendations.

The agent reads the relevant CSV to make data-driven design decisions instead of guessing.

## Core Capabilities

- **161 color palettes** — WCAG-verified hex values by product type (SaaS, fintech, healthcare, gaming, etc.)
- **57 font pairings** — heading + body with mood keywords, Google Fonts URLs, Tailwind config
- **161 product types** — style, landing pattern, dashboard style, color focus per product
- **99 UX guidelines** — structured Do/Don't pairs with severity (CRITICAL/HIGH/MEDIUM/LOW)
- **25 chart types** — data type → best chart, accessibility grade, library recommendation
- **WCAG 2.1 AA standards** — contrast (4.5:1/3:1), touch targets (44px), keyboard nav
- **Quality checklist** — visual, responsive, accessibility, performance, interaction checks

## Data Assets

| File | Rows | Lookup by |
|------|------|-----------|
| `assets/colors.csv` | 161 | Product type → hex palette |
| `assets/typography.csv` | 57 | Mood/use case → font pairing |
| `assets/products.csv` | 161 | Product type → style/color/dashboard recs |
| `assets/ux-guidelines.csv` | 99 | Category → Do/Don't with severity |
| `assets/charts.csv` | 25 | Data type → chart + library |

## When to Use This

::: tip Use meow:ui-design-system when...
- Creating or reviewing UI components
- Setting up a project's design system
- Selecting color palettes (look up, don't guess)
- Choosing typography (57 pre-tested pairings)
- Checking WCAG accessibility compliance
- Choosing chart visualizations
:::

::: info Skill Details
**Phase:** 3 (Build) — loaded by ui-ux-designer and developer agents
**Source:** claudekit-engineer/ui-ux-pro-max (MIT)
:::

## Gotchas

- **Ignoring the data**: guessing palette when colors.csv has WCAG-verified values → always look up first
- **Aesthetic over accessibility**: beautiful design that fails WCAG → check contrast before shipping
- **Generic product assumptions**: all SaaS looks the same → check products.csv for specific recommendations

## Related

- [`meow:frontend-design`](/reference/skills/frontend-design) — Anti-AI-slop enforcement + implementation rules
- [`meow:react-patterns`](/reference/skills/react-patterns) — React/Next.js performance patterns
- [`meow:vue`](/reference/skills/vue) — Vue 3 component patterns
- [`meow:angular`](/reference/skills/angular) — Angular v20+ patterns
