# Teleport

**Trigger:** overlays and portals — render UI outside the component's DOM position to escape stacking contexts, overflow, or transform constraints.

## Contents

- [Why Teleport](#why-teleport)
- [Responsive layout — disable on mobile](#responsive-layout--disable-on-mobile)
- [Vue hierarchy is preserved](#vue-hierarchy-is-preserved)
- [Multiple teleports to the same target](#multiple-teleports-to-the-same-target)

---

## Why Teleport

When an ancestor has `transform`, `filter`, or `perspective`, fixed-position children
are scoped to that ancestor — modals appear offset or clipped. Teleport moves the
DOM node to `body` (or another target) while keeping the Vue component tree intact.

```vue
<!-- BAD: modal broken inside a transformed container -->
<template>
  <div class="translate-z-0">
    <button @click="open = true">Open</button>
    <div v-if="open" class="fixed inset-0 z-50 bg-black/50">Modal</div>
  </div>
</template>
```

```vue
<!-- GOOD: modal escapes the transformed ancestor -->
<script setup lang="ts">
import { ref } from 'vue'

const open = ref(false)
</script>

<template>
  <div class="translate-z-0">
    <button class="rounded px-3 py-1" @click="open = true">Open</button>

    <Teleport to="body">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="open = false"
      >
        <div class="w-96 rounded bg-white p-6 shadow-xl">
          <p>Modal content</p>
          <button class="mt-4 text-sm underline" @click="open = false">Close</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
```

Focus-trap and escape-key handling are the app's responsibility — Teleport moves the
DOM but does not manage keyboard interaction.

---

## Responsive layout — disable on mobile

Use `:disabled` to render inline on small screens and teleport on larger ones.

```vue
<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

const isMobile = useMediaQuery('(max-width: 768px)')
</script>

<template>
  <Teleport to="body" :disabled="isMobile">
    <nav class="sidebar">Navigation</nav>
  </Teleport>
</template>
```

---

## Vue hierarchy is preserved

Teleport changes DOM position only. Props, emits, slots, and provide/inject all
work across the teleport boundary.

```vue
<template>
  <Teleport to="body">
    <!-- ChildPanel receives parent props/emits normally -->
    <ChildPanel :message="message" @close="open = false" />
  </Teleport>
</template>
```

---

## Multiple teleports to the same target

Teleported nodes append in declaration order. Use a shared container for related
UI and rely on ordering rather than z-index when possible.

```vue
<template>
  <Teleport to="#notifications">
    <div class="toast">First notification</div>
  </Teleport>

  <Teleport to="#notifications">
    <div class="toast">Second notification</div>
  </Teleport>
</template>
```

Apply `z-index` only when explicit layering is required beyond append order.
