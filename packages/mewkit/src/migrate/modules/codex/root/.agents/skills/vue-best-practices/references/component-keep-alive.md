# KeepAlive

**Trigger:** stateful view caching — preserve component state across dynamic-component or router-view switches.

## Contents

- [When to use / avoid](#when-to-use--avoid)
- [Basic usage — cap cache with max](#basic-usage--cap-cache-with-max)
- [Restrict caching with include/exclude](#restrict-caching-with-includeexclude)
- [Lifecycle hooks for cached components](#lifecycle-hooks-for-cached-components)
- [Cache invalidation — force a remount](#cache-invalidation--force-a-remount)
- [Router integration](#router-integration)

---

## When to use / avoid

| Use it when... | Avoid it when... |
|---|---|
| Tab panels where form/scroll state must persist | Search/filter pages where users expect fresh results |
| Multi-step forms switching between steps | Memory-heavy views (maps, large data tables) |
| Dashboards with expensive data already loaded | Sensitive flows that must clear data on exit |

---

## Basic usage — cap cache with `max`

Always set `max` to prevent unbounded memory growth.

```vue
<template>
  <KeepAlive :max="5">
    <component :is="currentTab" />
  </KeepAlive>
</template>
```

---

## Restrict caching with include/exclude

`include` and `exclude` match the component `name` option. Explicitly declare names
for reliable matching.

```vue
<!-- TabA.vue -->
<script setup lang="ts">
defineOptions({ name: 'TabA' })
</script>
```

```vue
<template>
  <KeepAlive include="TabA,TabB" :max="5">
    <component :is="currentTab" />
  </KeepAlive>
</template>
```

---

## Lifecycle hooks for cached components

`onMounted`/`onUnmounted` do NOT fire on tab switch. Use activation hooks instead.

```vue
<script setup lang="ts">
import { onActivated, onDeactivated } from 'vue'

// Called every time this component becomes active
onActivated(() => {
  refreshStaleData()
})

// Called every time this component is hidden (not destroyed)
onDeactivated(() => {
  pausePollingTimers()
})
</script>
```

---

## Cache invalidation — force a remount

Vue 3 has no direct API to evict a specific cached instance. Use a keyed component
to force remount on demand.

```vue
<script setup lang="ts">
import { ref, reactive } from 'vue'

const currentView = ref('Dashboard')
const viewKeys = reactive<Record<string, number>>({ Dashboard: 0, Settings: 0 })

const invalidate = (view: string): void => {
  viewKeys[view]++
}
</script>

<template>
  <button @click="invalidate('Dashboard')" class="text-sm underline">
    Refresh Dashboard
  </button>

  <KeepAlive :max="5">
    <component
      :is="currentView"
      :key="`${currentView}-${viewKeys[currentView]}`"
    />
  </KeepAlive>
</template>
```

---

## Router integration

Cache route components but key by `fullPath` so param changes force a fresh instance.

```vue
<template>
  <RouterView v-slot="{ Component, route }">
    <KeepAlive :max="8">
      <component :is="Component" :key="route.fullPath" />
    </KeepAlive>
  </RouterView>
</template>
```

If you want cache reuse with fresh data, omit the `:key` and fetch in `onActivated`,
comparing current params before issuing the request.
