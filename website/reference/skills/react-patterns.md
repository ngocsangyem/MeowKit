---
title: "meow:react-patterns"
description: "React and Next.js performance optimization — 45+ rules from Vercel Engineering. Auto-activates on .tsx/.jsx files."
---

# meow:react-patterns

React and Next.js performance optimization — 45+ rules across 8 priority categories from Vercel Engineering.

## What This Skill Does

`meow:react-patterns` provides battle-tested performance patterns for React and Next.js development. Rules are prioritized by impact — CRITICAL patterns (eliminating waterfalls, bundle optimization) can save 200-800ms, while MEDIUM patterns (re-render optimization) improve perceived responsiveness.

## Core Capabilities

- **5 reference categories** — async patterns, bundle optimization, server patterns, re-render optimization, rendering performance
- **Priority-ranked** — CRITICAL → HIGH → MEDIUM so you fix highest-impact issues first
- **Code examples** — every rule has problem/solution with concrete code
- **Vercel Engineering source** — patterns proven at scale (Next.js, Vercel platform)

## Rule Categories

| Priority | Category | Key wins |
|----------|----------|----------|
| CRITICAL | Async patterns | Promise.all, Suspense boundaries, defer await |
| CRITICAL | Bundle size | No barrel imports (saves 200-800ms), dynamic imports |
| HIGH | Server performance | React.cache(), parallel fetching, minimize serialization |
| MEDIUM | Re-render optimization | Derived state, functional setState, memo, transitions |
| MEDIUM | Rendering performance | content-visibility, hoist JSX, conditional render |

## When to Use This

::: tip Use meow:react-patterns when...
- Writing or reviewing React/Next.js components
- Fixing performance issues (slow load, janky UI, large bundle)
- Deciding server vs client component boundaries
- Optimizing data fetching patterns
:::

::: info Skill Details
**Phase:** 3 (Build) — auto-activates on .tsx/.jsx files alongside meow:typescript
:::

## Gotchas

- **Premature optimization**: profile first with React DevTools Profiler, then optimize
- **Over-memoizing**: React.memo only when profiler confirms expensive re-renders
- **Barrel file trap**: importing from index.ts pulls entire module — always import from source

## Related

- [`meow:typescript`](/reference/skills/typescript) — TypeScript type safety (complements React patterns)
- [`meow:vue`](/reference/skills/vue) — Vue 3 patterns (equivalent for Vue projects)
- [`meow:frontend-design`](/reference/skills/frontend-design) — UI/UX design patterns
