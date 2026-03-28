---
name: meow:ui-design-system
version: 1.0.0
description: |
  Use when designing UI components, creating design systems, reviewing visual design,
  or checking accessibility compliance. Triggers on "design system", "UI review",
  "color palette", "font pairing", "accessibility audit", "responsive design",
  "WCAG check". Auto-activates when ui-ux-designer agent is working.
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

Design intelligence for UI/UX work: styles, accessibility standards, responsive rules, and quality checklists.

Merges capabilities of CK's ui-ux-pro-max (design patterns) + web-design-guidelines (compliance) into one MeowKit skill.

## When to Use

- Creating or reviewing UI components
- Setting up a design system for a new project
- Checking WCAG accessibility compliance
- Selecting color palettes, typography, or UI styles
- Responsive design review

## Process

1. **Understand requirements** — what product type? what audience? what style direction?
2. **Load relevant reference** — select from references/ based on design task:
   - Visual design → `references/design-patterns.md`
   - Accessibility → `references/accessibility-standards.md`
   - Quality check → `references/quality-checklist.md`
3. **Apply standards** — use reference guidelines to create or review design
4. **Validate** — check output against quality-checklist.md before handoff

## Gotchas

- **Aesthetic over accessibility**: beautiful design that fails WCAG → always check contrast ratios (4.5:1 normal, 3:1 large) before shipping
- **Desktop-first design**: designing for large screens then cramming into mobile → always start from 320px, expand up
- **Color-only communication**: using red/green alone for status → always pair color with icon or text label

## Workflow Integration

Loaded by `ui-ux-designer` agent during Phase 3 (Build). Also used by `developer` agent when implementing frontend components.
