---
title: "mk:frontend-design"
description: "Production-grade UI/UX design with anti-AI-slop checklist, WCAG accessibility, typography hierarchy, and responsive patterns."
---

# mk:frontend-design

Production-grade UI/UX design with anti-AI-slop checklist, WCAG accessibility, typography hierarchy, and responsive patterns.

## What This Skill Does

`mk:frontend-design` prevents AI-generated interfaces from looking like AI-generated interfaces. It enforces specific, opinionated design rules across typography, color, spacing, motion, and accessibility — and requires every output to pass a 10-point anti-slop checklist before delivery. The checklist targets the exact patterns that make AI-generated UIs look generic: system font stacks, pure black-on-white, centered-everything layouts, gratuitous gradients, and Lorem ipsum.

## Core Capabilities

- **Anti-AI-slop checklist** — 10 specific patterns to avoid, checked before every delivery
- **Typography hierarchy** — Display → heading → subhead → body → caption with intentional font pairing
- **Color system** — 1 primary + 1 accent + neutrals. Softened values (never pure #000 on #fff)
- **Spacing scale** — 4px base, consistent scale. Section spacing differs from component padding.
- **Motion rules** — Animate only state transitions and feedback. Micro: 100-200ms, Standard: 200-300ms.
- **Accessibility** — WCAG 2.1 AA minimum: 4.5:1 contrast, keyboard nav, focus indicators, reduced motion
- **Responsive** — Mobile-first, 44px touch targets, 16px minimum text on mobile

## When to Use This

::: tip Use mk:frontend-design when...
- Styling new UI components
- Reviewing design quality before shipping
- Fixing "it looks like AI made this" problems
- Setting up a design system or tokens
- Checking accessibility compliance
:::

## Usage

```bash
# Auto-activates on design/styling tasks
/mk:frontend-design improve the dashboard layout
/mk:frontend-design review this component's design
/mk:frontend-design set up design tokens
/mk:frontend-design check accessibility
```

## Example Prompts

| Prompt | What frontend-design does |
|--------|--------------------------|
| `make this look professional` | Applies typography hierarchy, color system, spacing scale, passes anti-slop check |
| `the login page looks generic` | Identifies specific anti-patterns (same-size text, no hierarchy, default inputs) → fixes each |
| `add dark mode support` | Inverts neutrals, reduces saturation 10-15%, maintains contrast ratios |
| `check accessibility` | Contrast audit, keyboard nav test, screen reader label verification |

## Quick Workflow

```
Detect task → Load design-rules.md reference
  → Apply: typography → color → spacing → motion
  → Anti-slop check (10-point checklist)
  → Accessibility audit (WCAG 2.1 AA)
  → Deliver only if all checks pass
```

::: info Skill Details
**Phase:** 3  
**Used by:** developer agent
:::

## Related

- [`mk:vue`](/reference/skills/vue) — Vue component patterns
- [`mk:typescript`](/reference/skills/typescript) — TypeScript for frontend
