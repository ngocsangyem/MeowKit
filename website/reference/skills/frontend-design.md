---
title: "mk:frontend-design"
description: "Production-grade UI/UX design — anti-AI-slop enforcement, WCAG 2.1 AA accessibility, typography, color, motion, responsive."
---

# mk:frontend-design

Production-grade UI/UX design with anti-AI-slop enforcement. Covers aesthetics, accessibility, typography, color, motion, responsive, and design tokens. Auto-activates on design tasks and UI reviews.

## When to use

Auto-activate on: design tasks, UI component styling, "make it look good", "improve the design", "fix the UI", "design review", design system work, CSS/styling changes. Explicit: `/mk:frontend-design [concern]`. NOT for Vue patterns (`mk:vue`), TypeScript (`mk:typescript`), or backend code.

## Anti-AI-Slop checklist (mandatory before delivery)

| Category | NEVER | Do instead |
|---|---|---|
| Typography | System font stack only, single weight | 2-3 weights, intentional font pairing |
| Typography | All text same size/weight | Clear hierarchy: display → heading → body → caption |
| Typography | Inter as default font | Choose font matching project mood from typography.csv |
| Color | Pure black (#000) on pure white (#fff) | Softened: #111827 on #fafafa |
| Layout | Centered hero, 3-column features, testimonials, CTA | Unique layouts, product-specific patterns |
| Visual | unDraw/Storyset illustrations | Custom visuals or none |
| Visual | Default or missing favicon | Distinct favicon |
| Branding | "Built with love by the X team" footer | Real content or nothing |
| Branding | Product name = literal description (KanbanApp) | Distinctive naming |

## Process

1. Analyze — detect task type (new component, redesign, review, responsive), load design rules
2. Implement — apply typography, color, spacing, motion. Run anti-slop checklist. Ensure WCAG 2.1 AA.
3. Verify — pre-delivery checklist before presenting

## Phase anchor

Phase 3 (Build GREEN) and Phase 4 (Review) for design quality checks.
