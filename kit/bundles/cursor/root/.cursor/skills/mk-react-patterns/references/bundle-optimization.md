# Bundle Size Optimization (CRITICAL priority)

Every KB matters. Bundle size directly impacts Time to Interactive.

## bundle-barrel-imports
**Problem:** Importing from `index.ts` barrel files pulls entire module tree. Cost: 200-800ms added to load.
**Fix:** Import directly from source file.
```tsx
// BAD: pulls all of @mui/icons-material
import { Search } from '@mui/icons-material'

// GOOD: imports only the Search icon
import Search from '@mui/icons-material/Search'
```

## bundle-dynamic-imports
**Problem:** Heavy components loaded upfront even when not immediately visible.
**Fix:** Use `next/dynamic` or `React.lazy()` for below-fold or conditional components.
```tsx
const HeavyChart = dynamic(() => import('./heavy-chart'), {
  loading: () => <Skeleton height={400} />,
  ssr: false  // skip SSR for client-only components
})
```

## bundle-conditional
**Problem:** Feature code loaded even when feature is disabled.
**Fix:** Load module only when feature is activated.
```tsx
if (featureFlags.analytics) {
  const { initAnalytics } = await import('./analytics')
  initAnalytics()
}
```

## bundle-defer-third-party
**Problem:** Analytics, logging, chat widgets block initial render.
**Fix:** Load after hydration completes.
```tsx
useEffect(() => {
  import('./analytics').then(m => m.init())
}, [])
```

## bundle-preload
**Problem:** Navigation feels slow because next page JS loads on click.
**Fix:** Preload on hover/focus for perceived instant navigation.
```tsx
<Link href="/dashboard" onMouseEnter={() => router.prefetch('/dashboard')}>
```
