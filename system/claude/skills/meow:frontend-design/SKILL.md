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

1. **Detect task type** — new component? redesign? design review? responsive fix?
2. **Load design rules** — read `references/design-rules.md` for the concern
3. **Apply design principles** — typography, color, spacing, motion per rules
4. **Run anti-slop check** — verify against Anti-AI-Slop Checklist below
5. **Accessibility audit** — WCAG 2.1 AA minimum (see references)
6. **Pre-delivery check** — run full checklist before presenting to user

## Anti-AI-Slop Checklist (MANDATORY before delivery)

Every design output MUST pass these checks:

| Category        | Anti-Pattern (NEVER)                              | Do Instead                                                          |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| **Typography**  | System font stack only, single weight             | 2-3 weights, intentional font pairing                               |
| **Typography**  | All text same size/weight                         | Clear hierarchy: display → heading → body → caption                 |
| **Color**       | Pure black (#000) on pure white (#fff)            | Softened: #111827 on #fafafa or similar                             |
| **Color**       | Rainbow of unrelated colors                       | 1 primary + 1 accent + neutrals (3-5 colors total)                  |
| **Layout**      | Centered everything, card grid with equal spacing | Asymmetric layouts, intentional whitespace variation                |
| **Layout**      | Default padding/margin everywhere                 | Design tokens: consistent spacing scale (4px base)                  |
| **Content**     | "Lorem ipsum" in final delivery                   | Real or realistic content                                           |
| **Effects**     | Gratuitous shadows, gradients, blur               | Subtle shadows (0 1px 3px), purposeful gradients                    |
| **Components**  | Default browser inputs/buttons                    | Styled components with clear states (hover, focus, disabled)        |
| **Performance** | Unoptimized images, layout shift                  | Next-gen formats (WebP/AVIF), explicit dimensions, skeleton loaders |

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

## Failure Handling

| Failure                     | Recovery                                                               |
| --------------------------- | ---------------------------------------------------------------------- |
| No design system in project | Apply sensible defaults (neutral palette, system fonts with fallbacks) |
| Contrast ratio below 4.5:1  | Adjust colors — never ship inaccessible UI                             |
| Anti-slop check fails       | Fix failing items before delivery                                      |

## Handoff

On completion → `reviewer` agent for Phase 4 design dimension check.
