# Suspense

**Trigger:** async subtree fallback boundary — show a loading state while async components
or `async setup()` children resolve.

## Contents

- [Single root in default and fallback slots](#single-root-in-default-and-fallback-slots)
- [Fallback timing on re-triggers (timeout)](#fallback-timing-on-re-triggers-timeout)
- [Re-triggering pending state with a key](#re-triggering-pending-state-with-a-key)
- [Nested Suspense — suspensible](#nested-suspense--suspensible)
- [Track loading with events](#track-loading-with-events)
- [Nesting order with RouterView / Transition / KeepAlive](#nesting-order-with-routerview--transition--keepalive)

---

## Single root in default and fallback slots

Suspense tracks exactly one immediate child in each slot. Wrap multiple nodes.

```vue
<!-- BAD: multiple root nodes in default slot -->
<template>
  <Suspense>
    <AsyncHeader />
    <AsyncList />
    <template #fallback>
      <LoadingSpinner />
      <LoadingHint />
    </template>
  </Suspense>
</template>
```

```vue
<!-- GOOD: single wrapper root in each slot -->
<template>
  <Suspense>
    <div>
      <AsyncHeader />
      <AsyncList />
    </div>

    <template #fallback>
      <div class="flex flex-col gap-2">
        <LoadingSpinner />
        <LoadingHint />
      </div>
    </template>
  </Suspense>
</template>
```

---

## Fallback timing on re-triggers (timeout)

Once resolved, if new async work starts, the previous content stays visible until
`timeout` elapses. Set a short value to avoid a blank gap; `0` means immediate fallback.

```vue
<!-- GOOD: 200 ms before showing fallback prevents flicker on fast loads -->
<template>
  <Suspense :timeout="200">
    <component :is="currentView" :key="viewKey" />
    <template #fallback>
      <div class="animate-pulse rounded bg-gray-100 p-4">Loading…</div>
    </template>
  </Suspense>
</template>
```

---

## Re-triggering pending state with a key

Suspense only re-enters pending when the **root node of the default slot** changes.
Async work deeper in the tree produces no fallback. Use `:key` to swap the root.

```vue
<!-- BAD: async switching happens inside TabContainer, Suspense never re-triggers -->
<template>
  <Suspense>
    <TabContainer>
      <AsyncDashboard v-if="tab === 'dashboard'" />
      <AsyncSettings v-else />
    </TabContainer>
    <template #fallback>Loading…</template>
  </Suspense>
</template>
```

```vue
<!-- GOOD: root node changes on tab switch, Suspense re-triggers -->
<template>
  <Suspense>
    <component :is="tabs[tab]" :key="tab" />
    <template #fallback>Loading…</template>
  </Suspense>
</template>
```

---

## Nested Suspense — suspensible

Without `suspensible`, an inner Suspense boundary is independent. The parent cannot
coordinate its loading state with the inner boundary — inner async content may render
as empty nodes until resolved. Add `suspensible` to the inner boundary.

```vue
<!-- GOOD: inner boundary participates in parent coordination -->
<template>
  <Suspense>
    <LayoutShell>
      <Suspense suspensible>
        <AsyncWidget />
        <template #fallback>
          <div class="text-sm text-gray-500">Loading widget…</div>
        </template>
      </Suspense>
    </LayoutShell>

    <template #fallback>
      <div class="text-sm text-gray-500">Loading layout…</div>
    </template>
  </Suspense>
</template>
```

---

## Track loading with events

Use `@pending`, `@resolve`, and `@fallback` for global spinners, analytics, or
coordinating UI outside the boundary.

```vue
<script setup lang="ts">
import { ref } from 'vue'

const isLoading = ref(false)

const onPending = (): void => { isLoading.value = true }
const onResolve = (): void => { isLoading.value = false }
</script>

<template>
  <GlobalSpinner v-if="isLoading" />

  <Suspense @pending="onPending" @resolve="onResolve">
    <AsyncPage />
    <template #fallback>
      <PageSkeleton />
    </template>
  </Suspense>
</template>
```

---

## Nesting order with RouterView / Transition / KeepAlive

The correct nesting: `RouterView` → `Transition` → `KeepAlive` → `Suspense`.

```vue
<!-- GOOD -->
<template>
  <RouterView v-slot="{ Component }">
    <Transition mode="out-in">
      <KeepAlive :max="8">
        <Suspense>
          <component :is="Component" />
          <template #fallback>
            <div class="animate-pulse p-4">Loading…</div>
          </template>
        </Suspense>
      </KeepAlive>
    </Transition>
  </RouterView>
</template>
```

In production, keep Suspense boundaries minimal and document each one — they are
non-trivial to refactor once established.
