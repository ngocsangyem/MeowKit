---
title: "mk:react-patterns"
description: "React/Next.js performance optimization — waterfall elimination, bundle optimization, re-render reduction. Provides context-aware rules."
---

# mk:react-patterns

React and Next.js performance optimization across priority categories. Complements `mk:typescript` (type safety) and `mk:vue` (Vue patterns). Auto-activates on `.tsx`/`.jsx` files when React project detected.

## When to use

- Writing or reviewing React/Next.js components
- Optimizing bundle size or render performance
- Fixing re-render issues
- Server vs client component decisions
- Data fetching patterns

## Rule categories (by priority)

| Priority | Category | Key rules |
|---|---|---|
| CRITICAL | Eliminating waterfalls | Defer await, parallel promises, Suspense boundaries |
| CRITICAL | Bundle size | No barrel imports, dynamic imports, defer third-party |
| HIGH | Server performance | `React.cache()`, LRU cache, parallel fetching, `after()` |
| MEDIUM | Re-render optimization | Derived state, functional setState, memo, transitions |
| MEDIUM | Rendering performance | `content-visibility`, hoist JSX, conditional render |
