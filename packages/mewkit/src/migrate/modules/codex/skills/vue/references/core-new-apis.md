# Core New APIs (Vue 3.4 / 3.5)

Newer first-party APIs not covered by `components.md` or `reactivity-performance.md`. Foundation
reactivity (`ref`/`reactive`/`computed`/`watch`/`watchEffect`, `toRefs`, the `onCleanup` **callback
param**) lives in `reactivity-performance.md` — this file is the 3.4/3.5 delta.

## Contents

- [useId — SSR-stable unique IDs](#useid--ssr-stable-unique-ids)
- [nextTick — await the DOM flush](#nexttick--await-the-dom-flush)
- [Watcher flush timing](#watcher-flush-timing)
- [New watch options: once, bounded deep](#new-watch-options-once-bounded-deep)
- [onWatcherCleanup — cleanup from helpers](#onwatchercleanup--cleanup-from-helpers)
- [Reactive props destructure — watch caveat](#reactive-props-destructure--watch-caveat)

---

## useId — SSR-stable unique IDs

`useId()` (3.5) returns an app-unique string that matches across server and client render, so it is
safe for hydration. Use it to wire `label`/`aria-*` to inputs without hand-rolled counters.

```vue
<script setup lang="ts">
import { useId } from 'vue'

const id = useId()
</script>

<template>
  <label :for="id" class="block text-sm font-medium text-gray-700">Email</label>
  <input :id="id" type="email" class="mt-1 rounded border border-gray-300 px-3 py-1.5" />
</template>
```

---

## nextTick — await the DOM flush

State changes update the DOM asynchronously. `await nextTick()` to read/measure the DOM *after*
Vue has applied pending changes (e.g. focus a freshly-rendered node, measure new layout).

```ts
import { nextTick, ref } from 'vue'

const show = ref(false)

const open = async (): Promise<void> => {
  show.value = true
  await nextTick() // DOM now reflects show=true
  document.querySelector<HTMLInputElement>('#field')?.focus()
}
```

---

## Watcher flush timing

By default watcher callbacks run **before** the component re-renders (`flush: 'pre'`). Change the
timing when a callback must read the updated DOM, or must run synchronously.

| Option            | Runs                                  | Shorthand            |
| ----------------- | ------------------------------------- | -------------------- |
| `flush: 'pre'`    | before render (default)               | —                    |
| `flush: 'post'`   | after render — DOM is updated         | `watchPostEffect()`  |
| `flush: 'sync'`   | synchronously on every change (rare)  | `watchSyncEffect()`  |

```ts
import { watch, watchPostEffect, ref } from 'vue'

const items = ref<string[]>([])

// needs the rendered list height → run after the DOM updates
watch(items, () => measureListHeight(), { flush: 'post' })

// equivalent auto-tracking shorthand
watchPostEffect(() => measureListHeight())
```

---

## New watch options: once, bounded deep

- `once: true` (3.4) — run the callback at most once, then auto-stop. Avoids a manual
  unwatch-after-first-fire.
- `deep: <number>` (3.5) — limit deep traversal to a fixed depth instead of `deep: true`'s full
  walk, cutting tracking cost on large nested objects.

```ts
import { watch, ref } from 'vue'

const ready = ref(false)
watch(ready, () => init(), { once: true }) // fires once, then stops

const tree = ref({ a: { b: { c: 1 } } })
watch(tree, onTreeChange, { deep: 2 }) // track only 2 levels down
```

---

## onWatcherCleanup — cleanup from helpers

The `onCleanup` **callback param** (see `reactivity-performance.md`) only exists at the watcher
signature. `onWatcherCleanup()` (3.5) is an importable function that registers against the
*currently-running* watcher, so a reusable helper invoked **synchronously** inside the watcher can
register its own cleanup — no need to thread `onCleanup` through every call.

```ts
import { watch, onWatcherCleanup, ref } from 'vue'

const query = ref('')

// reusable helper registers its own cancellation
const fetchCancelable = (url: string): Promise<Response> => {
  const controller = new AbortController()
  onWatcherCleanup(() => controller.abort()) // bound to the active watcher
  return fetch(url, { signal: controller.signal })
}

watch(query, async (q) => {
  const res = await fetchCancelable(`/api/search?q=${encodeURIComponent(q)}`)
  // ...consume res
})
```

> Must be called synchronously during the watcher run (before any `await`). After an `await` the
> active-watcher context is gone — use the `onCleanup` param form for post-await cancellation.

---

## Reactive props destructure — watch caveat

Destructuring `defineProps` keeps reactivity (3.5) — `components.md` owns the **syntax + defaults**.
The delta: a destructured prop is a plain variable, so to **watch** it (or pass it somewhere that
expects a reactive source) you must wrap it in a getter.

```vue
<script setup lang="ts">
import { watch } from 'vue'

const { count = 0 } = defineProps<{ count?: number }>()

// ❌ watches a one-time snapshot — never re-fires
// watch(count, run)

// ✅ getter tracks the live prop
watch(() => count, run)

// ✅ pass a getter into a composable, not the bare variable
useChart(() => count)
</script>
```
