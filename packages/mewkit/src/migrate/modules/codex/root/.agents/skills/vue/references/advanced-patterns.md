# Advanced Patterns

Reactivity escape hatches and scope control for cases the everyday APIs do not cover. Reach for
these deliberately — most components never need them. Foundation reactivity is in
`reactivity-performance.md`; `shallowRef`/`shallowReactive` and provider `readonly()` are owned by
`mk:vue-best-practices` (cross-linked below, not restated here).

## Contents

- [effectScope — group and dispose effects](#effectscope--group-and-dispose-effects)
- [customRef — refs with custom tracking](#customref--refs-with-custom-tracking)
- [triggerRef — force a shallowRef update](#triggerref--force-a-shallowref-update)
- [markRaw — opt out of reactivity](#markraw--opt-out-of-reactivity)
- [shallowReadonly — top-level readonly](#shallowreadonly--top-level-readonly)

---

## effectScope — group and dispose effects

`effectScope()` collects every `watch`/`computed`/`watchEffect` created inside it so they can be
stopped together with one `scope.stop()`. Use it when effects are created **outside** a component's
`setup` (a shared/global composable, a manually-managed singleton) and would otherwise leak.
`onScopeDispose()` registers cleanup tied to the scope; `getCurrentScope()` checks for an active one.

```ts
// composables/use-shared-pulse.ts — one scope shared by all callers
import { effectScope, ref, watch, onScopeDispose } from 'vue'

const createPulse = () => {
  const scope = effectScope(true) // detached: not tied to a parent component
  const tick = ref(0)

  scope.run(() => {
    const id = setInterval(() => tick.value++, 1000)
    onScopeDispose(() => clearInterval(id))
    watch(tick, (t) => t % 60 === 0 && console.log('minute'))
  })

  return { tick, stop: () => scope.stop() } // stop() disposes every effect above
}

let shared: ReturnType<typeof createPulse> | null = null

const useSharedPulse = () => (shared ??= createPulse())

export default useSharedPulse
```

---

## customRef — refs with custom tracking

`customRef()` builds a ref with explicit control over when it tracks reads and triggers updates —
the idiomatic way to debounce an input-bound value without an extra watcher.

```ts
// composables/use-debounced-ref.ts
import { customRef } from 'vue'

const useDebouncedRef = <T>(value: T, delay = 300) =>
  customRef<T>((track, trigger) => {
    let timeout: ReturnType<typeof setTimeout>
    return {
      get: () => {
        track()
        return value
      },
      set: (next) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => {
          value = next
          trigger() // notify dependents only after the delay
        }, delay)
      },
    }
  })

export default useDebouncedRef
```

```vue
<script setup lang="ts">
import useDebouncedRef from '@/composables/use-debounced-ref'

const search = useDebouncedRef('', 400) // template binds it like any ref
</script>

<template>
  <input v-model="search" class="rounded border border-gray-300 px-3 py-1.5" />
</template>
```

---

## triggerRef — force a shallowRef update

A `shallowRef` only reacts to `.value` replacement, not to deep mutation. When you intentionally
mutate its contents in place (perf-sensitive bulk edit), call `triggerRef()` to flush dependents
once, instead of replacing the whole value.

```ts
import { shallowRef, triggerRef } from 'vue'

const points = shallowRef<number[]>([])

const pushMany = (values: number[]): void => {
  points.value.push(...values) // mutate in place — no automatic trigger
  triggerRef(points)           // single explicit update
}
```

> When to choose `shallowRef` vs `ref` is owned by `mk:vue-best-practices` ›
> `reactivity-advanced.md`. This is only the manual-trigger escape hatch.

---

## markRaw — opt out of reactivity

`markRaw()` permanently marks an object so Vue never makes it reactive, even nested inside reactive
state. Use it for heavy third-party instances (chart/map/editor handles) or large static config
where proxying is pure overhead or breaks the library's identity checks.

```ts
import { reactive, markRaw } from 'vue'
import { EditorView } from 'some-editor'

const state = reactive({
  // never proxied — Vue stores the raw instance
  editor: markRaw(new EditorView()),
  dirty: false,
})
```

> `markRaw` removes reactivity entirely; `shallowRef` keeps `.value`-replacement reactivity for an
> opaque object. Pick `shallowRef` when you still swap the instance, `markRaw` when you never need it
> tracked.

---

## shallowReadonly — top-level readonly

`shallowReadonly()` makes only the root-level properties read-only; nested objects stay mutable.
Use it to hand out a config object whose top-level keys must not be reassigned while allowing
nested working state.

```ts
import { shallowReadonly, reactive } from 'vue'

const config = shallowReadonly(reactive({
  endpoint: '/api',
  retry: { count: 0 }, // nested object is still writable
}))

// config.endpoint = '/v2' // ⚠️ warns — top level is read-only
config.retry.count++       // ✅ allowed — shallow only
```

> Deep `readonly()` (full lock, used for provide/inject contracts) is shown in
> `mk:vue-best-practices` › `component-data-flow-advanced.md`.
