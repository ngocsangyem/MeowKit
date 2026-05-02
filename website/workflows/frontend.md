---
title: Frontend Development
description: Build frontend features with Vue 3, TypeScript, and UI/UX design standards.
persona: B
---

# Frontend Development

> Vue 3 Composition API, strict TypeScript, and production-grade design — all enforced automatically.

**Best for:** UI features, component development, styling  
**Time estimate:** 15-60 minutes  
**Skills used:** [mk:vue](/reference/skills/vue), [mk:typescript](/reference/skills/typescript), [mk:frontend-design](/reference/skills/frontend-design)  
**Agents involved:** developer, tester, reviewer

## Overview

MeowKit has three specialized frontend skills that auto-activate based on file types:
- **mk:vue** — activates on `.vue` files → enforces Composition API, Pinia, `<script setup>`
- **mk:typescript** — activates on `.ts`/`.tsx` files → enforces strict null checks, type guards
- **mk:frontend-design** — activates on design/styling tasks → enforces anti-AI-slop checklist

## Building a Vue component

When you create or modify a `.vue` file, [mk:vue](/reference/skills/vue) enforces:

| Rule | Enforcement |
|------|------------|
| `<script setup lang="ts">` always | Options API (`data()`, `methods:`) blocked |
| `definePropsT()` with TypeScript interfaces | Runtime validation objects blocked |
| `storeToRefs()` for Pinia destructuring | Direct store state destructuring blocked |
| No `v-html` with user content | XSS vector (MeowKit security rule) |
| `ref()` for primitives | `reactive()` only for complex objects |
| PascalCase components, kebab-case files | MeowKit naming-rules.md enforced |

## TypeScript patterns

When editing `.ts` files, [mk:typescript](/reference/skills/typescript) enforces:

| Rule | Example |
|------|---------|
| No `any` type | Use `unknown` + type guards |
| No implicit truthiness | `if (user !== null)` not `if (user)` |
| `import type` for type-only | `import type { User } from './types'` |
| Named exports over default | `export const X` not `export default` |
| Discriminated unions for results | `{ ok: true; data: T } \| { ok: false; error: string }` |

## Design quality

Before delivering any UI, [mk:frontend-design](/reference/skills/frontend-design) runs the **anti-AI-slop checklist**:

| Check | Fail condition | Fix |
|-------|---------------|-----|
| Typography | All text same size | Add hierarchy: display → heading → body → caption |
| Color | Pure #000 on #fff | Soften: #111827 on #fafafa |
| Layout | Centered everything | Intentional asymmetry, whitespace variation |
| Spacing | Same padding everywhere | Use 4px-base scale consistently |
| Accessibility | Contrast < 4.5:1 | Adjust colors to meet WCAG AA |

## The review dimension

The **reviewer** agent checks a **performance** dimension specific to frontend:
- No unnecessary re-renders
- No unbounded data fetches
- No blocking in async
- Components lazy-loaded where appropriate

## Next workflow

→ [Researching Libraries](/workflows/research) — evaluate tech options before building
