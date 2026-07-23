# TransitionGroup

**Trigger:** animated list mutations — items entering, leaving, or moving in a `v-for` list.

## Contents

- [When to use TransitionGroup vs Transition](#when-to-use-transitiongroup-vs-transition)
- [Always provide stable keys](#always-provide-stable-keys)
- [tag prop for semantic wrappers](#tag-prop-for-semantic-wrappers)
- [mode is not supported](#mode-is-not-supported)
- [Move transitions — v-move class](#move-transitions--v-move-class)
- [Staggered animations with JS hooks](#staggered-animations-with-js-hooks)

---

## When to use TransitionGroup vs Transition

| Scenario | Use |
|---|---|
| Single element toggle / component swap | `<Transition>` |
| `v-for` list where items add, remove, or reorder | `<TransitionGroup>` |

---

## Always provide stable keys

Keys are required. Index keys break move animations because Vue cannot track item
identity across renders.

```vue
<!-- BAD: index keys cause incorrect move calculations -->
<template>
  <TransitionGroup name="list" tag="ul">
    <li v-for="(item, index) in items" :key="index">{{ item.name }}</li>
  </TransitionGroup>
</template>
```

```vue
<!-- GOOD: stable id-based keys -->
<template>
  <TransitionGroup name="list" tag="ul" class="space-y-2">
    <li
      v-for="item in items"
      :key="item.id"
      class="rounded border px-3 py-2"
    >
      {{ item.name }}
    </li>
  </TransitionGroup>
</template>
```

---

## tag prop for semantic wrappers

`<TransitionGroup>` renders no wrapper element by default. Use `tag` to emit a
semantic element without an extra wrapping `div`.

```vue
<template>
  <TransitionGroup name="cards" tag="ul" class="grid gap-4">
    <li v-for="card in cards" :key="card.id" class="rounded shadow p-4">
      {{ card.title }}
    </li>
  </TransitionGroup>
</template>
```

---

## mode is not supported

`mode="out-in"` is a `<Transition>` feature — it sequences leaving/entering of a
single element. `<TransitionGroup>` handles multiple simultaneous items and does not
support `mode`.

```vue
<!-- BAD: mode has no effect on TransitionGroup -->
<template>
  <TransitionGroup name="list" mode="out-in">
    <div v-for="item in items" :key="item.id">{{ item.name }}</div>
  </TransitionGroup>
</template>
```

If you need in/out sequencing, use `<Transition>` on a single component swap instead.

---

## Move transitions — v-move class

For reorder animations, add a `.list-move` CSS class (matches the `name` prop).
Vue applies `transform` internally during FLIP moves.

```css
.list-move,
.list-enter-active,
.list-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

/* Leaving items must be taken out of flow so FLIP moves compute correctly */
.list-leave-active {
  position: absolute;
}
```

---

## Staggered animations with JS hooks

Disable CSS transitions with `:css="false"` and drive timing in JS hooks for
per-item delay control.

```vue
<script setup lang="ts">
type Item = { id: number; name: string }

defineProps<{ items: Item[] }>()

const onBeforeEnter = (el: Element): void => {
  const node = el as HTMLElement
  node.style.opacity = '0'
  node.style.transform = 'translateY(12px)'
}

const onEnter = (el: Element, done: () => void): void => {
  const node = el as HTMLElement
  const index = Number(node.dataset.index)
  const delay = index * 60 // ms

  setTimeout(() => {
    node.style.transition = 'opacity 0.25s ease, transform 0.25s ease'
    node.style.opacity = '1'
    node.style.transform = 'translateY(0)'
    setTimeout(done, 250)
  }, delay)
}
</script>

<template>
  <TransitionGroup
    tag="ul"
    :css="false"
    class="space-y-2"
    @before-enter="onBeforeEnter"
    @enter="onEnter"
  >
    <li
      v-for="(item, index) in items"
      :key="item.id"
      :data-index="index"
      class="rounded border px-3 py-2"
    >
      {{ item.name }}
    </li>
  </TransitionGroup>
</template>
```
