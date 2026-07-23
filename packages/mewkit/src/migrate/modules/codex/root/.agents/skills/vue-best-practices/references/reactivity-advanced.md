Basics live in `mk:vue` references/reactivity-performance.md — this covers the deltas.

## Contents

- [shallowRef / shallowReactive matrix](#shallowref--shallowreactive-matrix)
- [Divergence note](#divergence-note)
- [Computed purity](#computed-purity)
- [Computed for class / style](#computed-for-class--style)
- [watch immediate:true](#watch-immediatetrue)
- [Async watcher cleanup](#async-watcher-cleanup)

---

## shallowRef / shallowReactive matrix

| API | Use when | Reactive on |
|---|---|---|
| `shallowRef(primitive)` | string, number, boolean, null | `.value` replacement only |
| `shallowRef(object)` | external instances, SDK handles, large opaque data | `.value` replacement only |
| `ref(object)` | frequently-replaced objects (fetched list, reset-to-defaults) | deep + `.value` replacement |
| `reactive(object)` | single state object mutated in-place (forms, stores) | deep property mutations |
| `shallowReactive(object)` | container where only top-level keys change; nested stays unproxied | top-level keys only |

### shallowRef for primitives

Prefer `shallowRef()` over `ref()` for primitive values — Vue skips deep-tracking machinery it can never use on scalars:

```ts
<script setup lang="ts">
import { shallowRef } from 'vue'

// shallowRef: no wasted deep-proxy setup for a plain number
const count = shallowRef(0)
const label = shallowRef('')
</script>
```

### shallowRef for opaque objects (class instances, external handles)

```ts
<script setup lang="ts">
import { shallowRef } from 'vue'
import { MapboxMap } from 'mapbox-gl'

// Vue must not proxy SDK internals — replace the ref to trigger an update
const mapInstance = shallowRef<MapboxMap | null>(null)

const onMapReady = (map: MapboxMap) => {
  mapInstance.value = map  // triggers reactivity; internal map state stays raw
}
</script>
```

### shallowReactive for container objects

```ts
<script setup lang="ts">
import { shallowReactive } from 'vue'

// Only top-level keys are reactive; nested payloads are deliberately unmanaged
const panel = shallowReactive({
  isOpen: false,
  data: { items: [] as string[] }  // data.items mutations are NOT reactive
})

panel.isOpen = true          // ✅ triggers update
panel.data.items.push('x')   // ❌ not reactive
panel.data = { items: ['x'] } // ✅ triggers update (top-level key replaced)
</script>
```

---

## Divergence note

> **Divergence:** this skill follows `shallowRef()` for primitives. `mk:vue` references/reactivity-performance.md states `ref()` for primitives. Both are accepted in this codebase; prefer the project's existing convention when one is established.

---

## Computed purity

Computed getters must be pure — no mutations, API calls, storage writes, or event emits. Put side effects in `watch()`.

```ts
<script setup lang="ts">
import { shallowRef, computed, watch } from 'vue'

const count = shallowRef(0)

// ✅ pure derivation
const doubled = computed(() => count.value * 2)

// ✅ side effect in watcher, not in computed
watch(count, (value) => {
  if (value > 10) console.warn('High count:', value)
})
</script>
```

---

## Computed for class / style

Extract complex class/style logic into a computed instead of inlining it in the template. Keeps templates readable and logic testable.

```vue
<script setup lang="ts">
import { computed } from 'vue'

type Props = {
  variant: 'primary' | 'danger'
  disabled?: boolean
}

const { variant, disabled = false } = defineProps<Props>()

const buttonClasses = computed(() => [
  'rounded px-4 py-2 font-medium transition',
  variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : '',
  variant === 'danger'  ? 'bg-red-600 text-white hover:bg-red-700' : '',
  disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
])
</script>

<template>
  <button :class="buttonClasses" :disabled="disabled">
    <slot />
  </button>
</template>
```

---

## watch immediate:true

Use `immediate: true` instead of duplicating the initial call in `onMounted`:

```ts
<script setup lang="ts">
import { shallowRef, watch } from 'vue'

const userId = shallowRef<number>(1)

// ❌ avoid duplicating the call
// onMounted(() => loadUser(userId.value))
// watch(userId, (id) => loadUser(id))

// ✅ single declaration, fires immediately and on every change
watch(
  userId,
  (id) => loadUser(id),
  { immediate: true }
)

const loadUser = async (id: number) => {
  // fetch logic
}
</script>
```

---

## Async watcher cleanup

Cancel in-flight requests when the watched source changes before the previous async op settles. Use the `onCleanup` parameter:

```ts
<script setup lang="ts">
import { shallowRef, ref, watch } from 'vue'

type Result = { id: number; name: string }

const query = shallowRef('')
const results = ref<Result[]>([])

watch(query, async (q, _prev, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
    })
    results.value = await res.json()
  } catch (err) {
    if ((err as Error).name !== 'AbortError') throw err
  }
})
</script>
```
