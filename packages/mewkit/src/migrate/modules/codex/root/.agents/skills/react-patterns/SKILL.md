---
name: "mk-react-patterns"
description: "React/Next.js authoring, review, and optimization: components, routes, bundle size, re-renders, performance. Auto-activates on .tsx/.jsx files alongside mk:typescript in React projects."
---

# React Patterns

React and Next.js performance optimization — curated rules across priority categories drawn from framework docs and production practice.

Complements `mk:typescript` (type safety) and `mk:vue` (Vue patterns). This skill covers React-specific performance patterns.

## When to Use

- Writing or reviewing React/Next.js components
- Optimizing bundle size or render performance
- Fixing re-render issues
- Server vs client component decisions
- Data fetching patterns

## Rule Categories (by priority)

Load the relevant reference when working in that area:

| Priority | Category               | Reference                             | Key rules                                             |
| -------- | ---------------------- | ------------------------------------- | ----------------------------------------------------- |
| CRITICAL | Eliminating waterfalls | `references/async-patterns.md`        | Defer await, parallel promises, Suspense boundaries   |
| CRITICAL | Bundle size            | `references/bundle-optimization.md`   | No barrel imports, dynamic imports, defer third-party |
| HIGH     | Server performance     | `references/server-patterns.md`       | React.cache(), LRU cache, parallel fetching, after()  |
| MEDIUM   | Re-render optimization | `references/rerender-optimization.md` | Derived state, functional setState, memo, transitions |
| MEDIUM   | Rendering perf         | `references/rendering-patterns.md`    | content-visibility, hoist JSX, conditional render     |

## Process

1. Identify the performance concern (waterfall? bundle? re-render? server?)
2. Load the matching reference file
3. Apply rules — each rule has: problem, solution, code example
4. Verify improvement (Lighthouse, bundle analyzer, React DevTools)

## Gotchas

- **Premature optimization**: optimizing re-renders before measuring → measure first with React DevTools Profiler
- **Over-memoizing**: wrapping everything in useMemo/React.memo → memo only when profiler shows expensive re-renders
- **Barrel file trap**: importing from index.ts pulls entire module → always import directly from source file

## Workflow Integration

Auto-activates during Phase 3 (Build) when React/Next.js project detected. Loaded by `developer` agent alongside `mk:typescript`.