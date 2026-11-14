# Transition

**Trigger:** enter/leave effects on a single element or component.

## Contents

- [Rules](#rules)
- [Single root element](#single-root-element)
- [Key same-tag swaps](#key-same-tag-swaps)
- [Component swap with mode](#component-swap-with-mode)
- [CSS classes — use transform/opacity](#css-classes--use-transformopacity)

---

## Rules

- `<Transition>` wraps exactly one direct child.
- Add `key` when switching between elements of the same tag — Vue reuses the DOM
  node otherwise and skips enter/leave.
- Use `mode="out-in"` to prevent the leaving and entering elements from overlapping.
- Prefer `transform` and `opacity` — they are GPU-composited and don't trigger layout.

---

## Single root element

```vue
<!-- BAD: multiple children -->
<template>
  <Transition name="fade">
    <h3>Title</h3>
    <p>Description</p>
  </Transition>
</template>
```

```vue
<!-- GOOD: single wrapper -->
<template>
  <Transition name="fade">
    <div>
      <h3>Title</h3>
      <p>Description</p>
    </div>
  </Transition>
</template>
```

---

## Key same-tag swaps

```vue
<!-- BAD: Vue reuses <p>, transition never fires -->
<template>
  <Transition name="fade">
    <p v-if="isActive">Active</p>
    <p v-else>Inactive</p>
  </Transition>
</template>
```

```vue
<!-- GOOD: distinct keys force new elements -->
<template>
  <Transition name="fade" mode="out-in">
    <p v-if="isActive" key="active">Active</p>
    <p v-else key="inactive">Inactive</p>
  </Transition>
</template>
```

---

## Component swap with mode

```vue
<script setup lang="ts">
import { ref } from 'vue'
import ViewA from './ViewA.vue'
import ViewB from './ViewB.vue'

const currentView = ref<'ViewA' | 'ViewB'>('ViewA')
const views = { ViewA, ViewB }
</script>

<template>
  <Transition name="slide" mode="out-in">
    <component :is="views[currentView]" :key="currentView" />
  </Transition>
</template>
```

---

## CSS classes — use transform/opacity

```css
/* BAD: triggers layout recalculation */
.slide-enter-active,
.slide-leave-active {
  transition: height 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  height: 0;
}
```

```css
/* GOOD: GPU-composited, no layout cost */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-enter-from {
  transform: translateX(-12px);
  opacity: 0;
}

.slide-leave-to {
  transform: translateX(12px);
  opacity: 0;
}
```

Tailwind users: apply transition classes via `:enter-active-class`, `:leave-active-class`,
`:enter-from-class`, and `:leave-to-class` props instead of a `name`.

```vue
<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    leave-active-class="transition-all duration-150 ease-in"
    enter-from-class="-translate-x-2 opacity-0"
    leave-to-class="translate-x-2 opacity-0"
  >
    <component :is="currentView" :key="currentView" />
  </Transition>
</template>
```
