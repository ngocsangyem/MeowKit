---
title: "mk:react-patterns"
description: "React/Next.js performance optimization — waterfall elimination, bundle optimization, re-render reduction. Context-aware rules across 5 priority categories."
---

# mk:react-patterns

React and Next.js performance optimization — curated rules across priority categories drawn from framework docs and production practice.

Complements `mk:typescript` (type safety) and `mk:vue` (Vue patterns). This skill covers React-specific performance patterns.

## What This Skill Does

Provides context-aware optimization rules for React/Next.js applications. Each rule follows the pattern: problem, solution, code example. Covers waterfall elimination, bundle size reduction, server-side caching, re-render optimization, and rendering performance.

## When to Use

- Writing or reviewing React/Next.js components
- Optimizing bundle size or render performance
- Fixing re-render issues
- Server vs client component decisions
- Data fetching patterns

**Auto-activate on:** `.tsx`/`.jsx` files when React project detected.

**Explicit:** `/mk:react-patterns [concern]`

## Core Capabilities

- **Waterfall elimination (CRITICAL)** — defer await, parallel promises, Suspense boundaries
- **Bundle optimization (CRITICAL)** — no barrel imports, dynamic imports, conditional loading, defer third-party
- **Server performance (HIGH)** — `React.cache()`, LRU cache, parallel fetching, `after()`
- **Re-render reduction (MEDIUM)** — derived state, functional setState, `React.memo`, transitions
- **Rendering performance (MEDIUM)** — `content-visibility`, hoist JSX, conditional render, hydration

## Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `concern` | string | Optional. Focus area: waterfall, bundle, server, re-render, rendering |

## Workflow

Auto-activates during **Phase 3 (Build)** when React/Next.js project detected. Loaded by `developer` agent alongside `mk:typescript`.

### Process

1. Identify the performance concern (waterfall? bundle? re-render? server?)
2. Load the matching reference file
3. Apply rules — each rule has: problem, solution, code example
4. Verify improvement (Lighthouse, bundle analyzer, React DevTools)

## Rule Categories (by priority)

| Priority | Category | Reference | Key Rules |
|----------|----------|-----------|-----------|
| CRITICAL | Eliminating waterfalls | `references/async-patterns.md` | Defer await, parallel promises, Suspense boundaries, allSettled |
| CRITICAL | Bundle size | `references/bundle-optimization.md` | No barrel imports, dynamic imports, conditional loading, defer third-party, preload |
| HIGH | Server performance | `references/server-patterns.md` | React.cache(), LRU cache, parallel fetching, serialization, after() |
| MEDIUM | Re-render optimization | `references/rerender-optimization.md` | Derived state, functional setState, memo, transitions, lazy state init |
| MEDIUM | Rendering performance | `references/rendering-patterns.md` | content-visibility, hoist JSX, conditional render, hydration, SVG precision |

## Patterns

### Eliminating Waterfalls (CRITICAL)

**Defer await:** Move await into the branch where the result is actually used.

```tsx
// BAD: blocks all subsequent code
const data = await fetchData()
if (condition) { use(data) }

// GOOD: only await when needed
const dataPromise = fetchData()
if (condition) { use(await dataPromise) }
```

**Parallel promises:** Use `Promise.all()` for independent operations.

```tsx
// BAD: waterfall — 600ms total
const users = await fetchUsers()    // 200ms
const posts = await fetchPosts()    // 200ms
const comments = await fetchComments() // 200ms

// GOOD: parallel — 200ms total
const [users, posts, comments] = await Promise.all([
  fetchUsers(), fetchPosts(), fetchComments()
])
```

**Suspense boundaries:** Wrap slow sections in `<Suspense>` with fallback.

```tsx
<Suspense fallback={<Skeleton />}>
  <SlowComponent />
</Suspense>
```

### Bundle Size (CRITICAL)

**No barrel imports:** Import directly from source file.

```tsx
// BAD: pulls all of @mui/icons-material
import { Search } from '@mui/icons-material'

// GOOD: imports only the Search icon
import Search from '@mui/icons-material/Search'
```

**Dynamic imports:** Use `next/dynamic` for below-fold components.

```tsx
const HeavyChart = dynamic(() => import('./heavy-chart'), {
  loading: () => <Skeleton height={400} />,
  ssr: false
})
```

**Defer third-party:** Load after hydration completes.

```tsx
useEffect(() => {
  import('./analytics').then(m => m.init())
}, [])
```

### Server Performance (HIGH)

**React.cache():** Per-request deduplication.

```tsx
const getUser = React.cache(async (id: string) => {
  return db.user.findUnique({ where: { id } })
})
// Called 3 times in different components — only 1 DB query
```

**LRU cache:** Cross-request caching with bounded memory.

```tsx
const cache = new LRUCache<string, Data>({ max: 500, ttl: 1000 * 60 * 5 })
```

**Serialization:** Select only needed fields before passing to client.

```tsx
// BAD: passes entire user object (50 fields)
<ClientProfile user={user} />

// GOOD: passes only what's rendered
<ClientProfile name={user.name} avatar={user.avatar} />
```

**after():** Non-blocking post-response work.

```tsx
import { after } from 'next/server'
after(() => { logAnalytics(event) }) // runs after response sent
```

### Re-render Optimization (MEDIUM)

**Derived state:** Subscribe to the minimum needed.

```tsx
// BAD: re-renders on every cart change
const cart = useStore(state => state.cart)
const isEmpty = cart.items.length === 0

// GOOD: re-renders only when empty changes
const isEmpty = useStore(state => state.cart.items.length === 0)
```

**Functional setState:** Stable callback references.

```tsx
// BAD: new function every render
const increment = () => setCount(count + 1)

// GOOD: stable function
const increment = () => setCount(prev => prev + 1)
```

**Transitions:** Non-urgent updates don't block typing.

```tsx
const handleSearch = (value: string) => {
  setQuery(value) // urgent: update input immediately
  startTransition(() => {
    setResults(filterResults(value)) // non-urgent: can be interrupted
  })
}
```

### Rendering Performance (MEDIUM)

**content-visibility:** Skip rendering off-screen content.

```css
.list-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

**Hoist static JSX:** Extract outside component.

```tsx
// BAD: recreated every render
function MyComponent() {
  const header = <h1>Title</h1> // new object each render
  return <div>{header}{/* dynamic content */}</div>
}

// GOOD: created once
const header = <h1>Title</h1>
function MyComponent() {
  return <div>{header}{/* dynamic content */}</div>
}
```

**Conditional render:** Avoid `&&` rendering `0` or `""`.

```tsx
// BAD: renders "0" when count is 0
{count && <Badge count={count} />}

// GOOD: renders nothing when count is 0
{count > 0 ? <Badge count={count} /> : null}
```

## Gotchas

- **Premature optimization**: optimizing re-renders before measuring — measure first with React DevTools Profiler
- **Over-memoizing**: wrapping everything in `useMemo`/`React.memo` — memo only when profiler shows expensive re-renders
- **Barrel file trap**: importing from `index.ts` pulls entire module — always import directly from source file

## Common Use Cases

- Fixing slow page loads caused by data waterfalls
- Reducing bundle size from barrel imports
- Optimizing server-side data fetching patterns
- Reducing unnecessary re-renders in complex component trees
- Improving rendering performance for long lists and off-screen content

## Example Prompt

> /mk:react-patterns waterfall
> My Next.js dashboard takes 3 seconds to load. I suspect sequential data fetching — find any calls that should be parallelized with Promise.all and add Suspense boundaries where needed.

## Pro Tips

- Always measure before optimizing — use React DevTools Profiler
- Fix CRITICAL priority issues first (waterfalls, bundle size) — highest impact
- Use `React.cache()` for any function called multiple times within a single request
- Don't memo everything — only wrap components the profiler shows as expensive
- For `Promise.all`, consider `Promise.allSettled()` when partial failures are acceptable
