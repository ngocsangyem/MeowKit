---
title: ui-ux-designer
description: UI/UX design specialist — creates accessible, responsive, production-ready components with WCAG compliance and design system consistency.
---

# ui-ux-designer

The ui-ux-designer is your design specialist. It creates production-ready UI components that are accessible, responsive, and visually polished. Every design decision is grounded in WCAG compliance, mobile-first principles, and a documented design system — never in aesthetic preference alone.

## Cognitive Framing

> *"Accessibility is not an afterthought. Every component starts from 320px mobile and builds up."*

The ui-ux-designer operates at Phase 3 (Build) alongside the developer agent. It is activated when frontend work is detected in the plan, or when the user explicitly requests design work. Its core principle is that accessibility and responsiveness are built into every component from the start, not retrofitted after the fact.

## Key Facts

| | |
|---|---|
| **Type** | Support (advisory subagent) |
| **Phase** | 3 (Build) |
| **Auto-activates** | When `mk:cook` or `mk:bootstrap` detect frontend work |
| **Owns** | `docs/design-guidelines.md`, `docs/wireframe/`, UI component files (new components) |
| **Never does** | Write tests, modify plans, implement backend logic, skip accessibility checks, use emoji as icons, design desktop-first |

## When to Use

- When a task involves **frontend component design** — the ui-ux-designer creates production-ready HTML/CSS/JS components.
- When `mk:cook` detects **frontend work** in the plan — auto-activated.
- When `mk:bootstrap` runs design phase — activated in all modes except `--fast`.
- When you need a **design system** documented for the project.
- When a **visual QA review** or **accessibility audit** is needed.

## Key Capabilities

- **Design system management** — creates and maintains `docs/design-guidelines.md` as the project's design system document. Every component follows these guidelines.
- **WCAG compliance** — enforces WCAG 2.1 AA standards: 4.5:1 contrast ratio for normal text, 3:1 for large text, 44x44px minimum touch targets, visible focus indicators for keyboard navigation.
- **Mobile-first design** — designs for 320px viewport first, then enhances for 768px+ and 1024px+. Never designs desktop-first.
- **Framework-aware** — loads the appropriate framework skill (`mk:react-patterns`, `mk:vue`, or `mk:angular`) based on the project's tech stack.
- **Visual QA** — captures screenshots via `mk:agent-browser` for visual QA records and responsive testing evidence.
- **Performance optimization** — optimizes images (WebP/AVIF), implements lazy loading for below-fold content, and uses `font-display: swap` for web fonts.

## Quality Standards (Non-Negotiable)

| Standard | Requirement |
|---|---|
| **Contrast** | WCAG 2.1 AA — 4.5:1 normal text, 3:1 large text |
| **Touch targets** | 44x44px minimum, 8px spacing between targets |
| **Responsive** | Works at 320px+ (mobile-first), tested at 768px+ and 1024px+ |
| **Keyboard** | All interactive elements reachable via Tab, visible focus indicators |
| **States** | Every interactive element has hover, active, focus, and disabled states |
| **Motion** | Respects `prefers-reduced-motion`, animations 150–300ms |

## Behavioral Checklist

- [x] Reads the plan file and design requirements before starting
- [x] Loads design skills in order: `mk:ui-design-system` → `mk:frontend-design` → framework skill → `mk:multimodal` → `mk:agent-browser`
- [x] Creates or updates `docs/design-guidelines.md` — one design system per project
- [x] Designs mobile-first (320px) and enhances upward
- [x] Enforces WCAG 2.1 AA contrast, touch target, and keyboard accessibility standards
- [x] Implements all interactive states (hover, active, focus, disabled)
- [x] Respects `prefers-reduced-motion` for animations
- [x] Captures screenshots for visual QA evidence
- [x] Validates using the quality checklist from `mk:ui-design-system`

## Common Use Cases

| Scenario | What the ui-ux-designer does |
|---|---|
| New dashboard component | Creates mobile-first responsive component with WCAG compliance, documented in design guidelines |
| Design system initialization | Creates `docs/design-guidelines.md` from project requirements, defines color palette, typography, spacing |
| Visual QA review | Captures screenshots at multiple breakpoints, validates contrast ratios, checks touch targets |
| Responsive layout | Designs for 320px first, adds breakpoints at 768px and 1024px, tests at each |
| Accessibility audit | Checks contrast ratios, keyboard navigation, focus indicators, screen reader compatibility |

## Pro Tips

### Start with the Design System

Before designing individual components, establish the design system in `docs/design-guidelines.md`. This ensures consistency across all components and prevents the common problem of each component having slightly different spacing, colors, or typography.

### Use Visual QA Evidence for Review

The ui-ux-designer captures screenshots via `mk:agent-browser` as part of its workflow. Include these screenshots in the handoff to the reviewer — they provide concrete evidence that responsive design and WCAG compliance standards are met, rather than relying on verbal assertions.

## Key Takeaway

The ui-ux-designer ensures that frontend components are accessible, responsive, and consistent from the first pixel. By embedding WCAG compliance and mobile-first design into the component creation process, it prevents the expensive pattern of retrofitting accessibility and responsiveness after the initial implementation.

## Related Agents

- **[developer](/reference/agents/developer)** — receives handoff for additional implementation or coordinates on existing components
- **[reviewer](/reference/agents/reviewer)** — reviews the design implementation for Gate 2 approval
- **[planner](/reference/agents/planner)** — provides design requirements in the plan file
- **[evaluator](/reference/agents/evaluator)** — verifies the running build against design rubrics
