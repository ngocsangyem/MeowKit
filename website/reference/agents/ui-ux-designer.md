---
title: ui-ux-designer
description: "UI/UX design agent that creates accessible, responsive, production-ready interfaces with WCAG 2.1 AA compliance."
---

# ui-ux-designer

UI/UX design agent that creates accessible, responsive, production-ready interfaces with WCAG 2.1 AA compliance.

## Overview

The ui-ux-designer creates and maintains design systems, builds production-ready UI components, and validates visual quality. It operates in Phase 3 (Build) alongside the developer agent, activated when frontend work is detected in a plan.

The agent loads design skills on demand: `mk:ui-design-system` for design intelligence, `mk:frontend-design` for implementation patterns, stack-specific skills (`mk:react-patterns` or `mk:vue`), `mk:multimodal` for image generation, and `mk:browse` for visual QA screenshots.

## Quick Reference

### Quality Standards (non-negotiable)

| Standard | Requirement |
|----------|-------------|
| Color contrast | WCAG 2.1 AA — 4.5:1 normal, 3:1 large text |
| Touch targets | 44×44px minimum, 8px spacing |
| Responsive | Works at 320px+ (mobile-first) |
| Keyboard | All interactive elements Tab-reachable |
| States | hover, active, focus, disabled for every interactive element |
| Motion | Respect `prefers-reduced-motion`, 150–300ms animations |

### Skills Loaded

| Skill | Purpose |
|-------|---------|
| [`mk:ui-design-system`](/reference/skills/ui-design-system) | Styles, palettes, WCAG, responsive rules, quality checklist |
| [`mk:frontend-design`](/reference/skills/frontend-design) | Design replication, anti-AI-slop |
| [`mk:react-patterns`](/reference/skills/react-patterns) | React/Next.js patterns (if React project) |
| [`mk:vue`](/reference/skills/vue) | Vue 3 patterns (if Vue project) |
| [`mk:multimodal`](/reference/skills/multimodal) | Image generation and visual analysis |
| [`mk:browse`](/reference/skills/browse) | Screenshots for visual QA |

### File Ownership

| Owns | Shared with |
|------|-------------|
| `docs/design-guidelines.md` | — (exclusive) |
| `docs/wireframe/` | — (exclusive) |
| UI component files | developer (coordinate on existing) |

## Workflow

```
Plan → Load design skills → Research trends → Create design guidelines
  → Design + implement components → Validate (quality checklist + screenshots)
  → Handoff to developer or reviewer
```

**Phase:** 3 (Build)
**Triggered by:** `mk:cook` (frontend detected), `mk:bootstrap` (design phase), explicit request
**Hands off to:** developer (more implementation) or reviewer (Gate 2)

## Design Principles

- **Mobile-first** — 320px up, not desktop down
- **Accessibility built-in** — not bolted on after
- **One design system** — documented in `docs/design-guidelines.md`
- **Performance** — optimized images, lazy loading, font-display: swap
- **No emoji icons** — always SVG or icon library
