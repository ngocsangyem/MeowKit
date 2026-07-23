# Reactivity & Performance

## Contents

- [Reactivity Rules](#reactivity-rules)
- [Destructuring Reactive State](#destructuring-reactive-state)
- [Performance Patterns](#performance-patterns)

## Reactivity Rules

| API                            | Use for                          | Why                                                |
| ------------------------------ | -------------------------------- | -------------------------------------------------- |
| `ref()`                        | primitives (and most state)      | explicit `.value`; can reassign; works everywhere  |
| `reactive()`                   | complex objects (when needed)    | no `.value`, but you cannot reassign the whole obj  |
| `computed()`                   | derived state                    | cached; recomputes only when dependencies change   |
| `watch()`                      | side effects from specific deps  | async ops, API calls, logging; explicit sources    |
| `watchEffect()`                | side effects with auto-tracking  | auto-detects deps; register cleanup for async work  |
| `toRef()` / `toRefs()`         | keeping reactivity on destructure| preserves links when pulling fields off an object  |

Default to `ref()`. Reach for `reactive()` only when an object is genuinely more ergonomic without
`.value` — and remember you cannot reassign it wholesale.

## Destructuring Reactive State

Destructuring a `reactive()` object detaches the fields from reactivity:

```ts
import { reactive, toRefs } from 'vue'

const state = reactive({ count: 0, name: 'x' })

// ❌ count is now a plain number — updates to state.count won't reflect
const { count } = state

// ✅ keep reactivity
const { count, name } = toRefs(state)
```

For `watchEffect` that kicks off async work, always cancel the previous run to avoid stale writes
on fast re-renders:

```ts
import { watchEffect } from 'vue'

watchEffect((onCleanup) => {
  const controller = new AbortController()
  fetch(`/api/items/${id.value}`, { signal: controller.signal })
  onCleanup(() => controller.abort())
})
```

## Performance Patterns

```vue
<template>
  <!-- v-once: render static content one time, then skip updates -->
  <span v-once>{{ expensiveOneTimeValue }}</span>

  <!-- v-memo: re-render the subtree only when listed deps change -->
  <div v-memo="[item.id, item.selected]">
    {{ item.name }}
  </div>
</template>
```

Code-split heavy components so they load on demand:

```vue
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const HeavyChart = defineAsyncComponent(() => import('./HeavyChart.vue'))
</script>
```

Measure before optimizing — use the Vue DevTools performance panel to confirm a component is
actually a hotspot before adding `v-memo`/`v-once` or splitting it out.
