# Async Components

**Use only when:** a component is heavy or rarely viewed and should be lazy-loaded to reduce the initial bundle. Do not use for every component — only those where the load cost justifies deferred parsing.

> The basic `defineAsyncComponent` call is covered in `mk:vue` → `references/reactivity-performance.md`. This doc adds: Suspense pairing, lazy hydration strategies (Vue 3.5+), and `loading`/`error`/`delay`/`timeout` options.

## Loading + error + delay + timeout options

Always pair `loadingComponent` with a `delay` to suppress flicker for fast loads, and set `timeout` so stuck loads surface an error rather than spinning forever.

```vue
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import LoadingSpinner from '@/components/loading-spinner.vue'
import ErrorDisplay from '@/components/error-display.vue'

const AsyncDashboard = defineAsyncComponent({
  loader: () => import('./dashboard.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorDisplay,
  delay: 200,      // ms before loading UI appears — prevents flicker on fast loads
  timeout: 30000,  // ms before error component is shown
})
</script>

<template>
  <AsyncDashboard />
</template>
```

### Delay guidelines

| Scenario | `delay` |
|---|---|
| Small component, fast network | `200` (default) |
| Known-heavy component | `100` |
| Non-critical background UI | `300–500` |

## Suspense pairing

Wrap async components in `<Suspense>` when you want declarative loading/error UI at a higher level instead of per-component props:

```vue
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const AsyncComments = defineAsyncComponent(
  () => import('./comments.vue')
)
</script>

<template>
  <Suspense>
    <template #default>
      <AsyncComments />
    </template>
    <template #fallback>
      <div class="p-4 text-slate-500 animate-pulse">Loading comments…</div>
    </template>
  </Suspense>
</template>
```

`<Suspense>` also works with `async setup()` components and top-level `await` in `<script setup>`.

## Lazy hydration (Vue 3.5+, SSR only)

In SSR apps, defer client-side hydration of non-critical components until idle time or visibility. This speeds up Time to Interactive without removing the server-rendered HTML.

```vue
<script setup lang="ts">
import { defineAsyncComponent, hydrateOnVisible, hydrateOnIdle } from 'vue'

// Hydrate when the element scrolls into view
const AsyncComments = defineAsyncComponent({
  loader: () => import('./comments.vue'),
  hydrate: hydrateOnVisible({ rootMargin: '100px' }),
})

// Hydrate during browser idle time (max 5s wait)
const AsyncFooter = defineAsyncComponent({
  loader: () => import('./footer.vue'),
  hydrate: hydrateOnIdle(5000),
})
</script>

<template>
  <AsyncComments />
  <AsyncFooter />
</template>
```

Other hydration strategies from Vue core: `hydrateOnInteraction`, `hydrateOnMediaQuery`.

> Only import the hydration helpers you actually use — each adds a small runtime cost.
