# Component Slots — Deep Reference

Basic slot syntax → `mk:vue` references/components.md

**Trigger:** parent controls child content or layout, including scoped slots and slot props.

## Contents

- [Named slots with shorthand](#named-slots-with-shorthand)
- [Conditional slot wrappers](#conditional-slot-wrappers)
- [Typed scoped slots with defineSlots](#typed-scoped-slots-with-defineslots)
- [Slot fallback content](#slot-fallback-content)
- [Scoped slots — consuming slot props](#scoped-slots--consuming-slot-props)
- [Renderless vs composable pattern](#renderless-vs-composable-pattern)

---

## Named slots with shorthand

Use `#` instead of `v-slot:`.

```vue
<!-- consumer -->
<MyComponent>
  <template #header><h3>Title</h3></template>
  <template #default><p>Body</p></template>
  <template #footer><small>Footer</small></template>
</MyComponent>
```

---

## Conditional slot wrappers

Only render wrapper elements when the slot has content — avoids empty DOM nodes
that carry spacing, borders, or layout constraints.

```vue
<!-- Card.vue -->
<script setup lang="ts">
// No script logic needed; $slots is a template-only accessor.
</script>

<template>
  <article class="rounded border p-4">
    <header v-if="$slots.header" class="mb-3 border-b pb-2">
      <slot name="header" />
    </header>

    <section v-if="$slots.default" class="py-2">
      <slot />
    </section>

    <footer v-if="$slots.footer" class="mt-3 border-t pt-2">
      <slot name="footer" />
    </footer>
  </article>
</template>
```

---

## Typed scoped slots with defineSlots

`defineSlots` gives consumers autocomplete and static type-checking for slot props.

```vue
<!-- ProductList.vue -->
<script setup lang="ts">
type Product = {
  id: number
  name: string
  price: number
}

defineProps<{ products: Product[] }>()

// Declares the slot contract — consumers get type-safe slot props.
defineSlots<{
  default(props: { product: Product; index: number }): unknown
  empty(): unknown
}>()
</script>

<template>
  <ul v-if="products.length" class="space-y-2">
    <li v-for="(product, index) in products" :key="product.id">
      <slot :product="product" :index="index" />
    </li>
  </ul>
  <slot v-else name="empty">
    <p class="text-gray-500">No products found.</p>
  </slot>
</template>
```

---

## Slot fallback content

Provide defaults so slots degrade gracefully when the parent omits content.

```vue
<!-- SubmitButton.vue -->
<template>
  <button type="submit" class="rounded bg-blue-600 px-4 py-2 text-white">
    <slot>Submit</slot>
  </button>
</template>
```

---

## Scoped slots — consuming slot props

The consumer uses `v-slot` (or `#`) with destructuring to read props exposed by the child.

```vue
<!-- parent -->
<ProductList :products="catalog">
  <template #default="{ product, index }">
    <span class="text-sm text-gray-400">{{ index + 1 }}.</span>
    <strong>{{ product.name }}</strong>
    <span class="ml-auto">${{ product.price }}</span>
  </template>

  <template #empty>
    <p class="italic text-gray-400">The catalog is empty.</p>
  </template>
</ProductList>
```

---

## Renderless vs composable pattern

Renderless components expose logic through slots; composables are cleaner for
logic-only reuse with no required template shape.

**Prefer composables** when the consumer supplies its own markup:

```ts
// composables/use-mouse.ts
import { ref, onMounted, onUnmounted } from 'vue'

export const useMouse = () => {
  const x = ref(0)
  const y = ref(0)

  const onMove = (e: MouseEvent): void => {
    x.value = e.pageX
    y.value = e.pageY
  }

  onMounted(() => window.addEventListener('mousemove', onMove))
  onUnmounted(() => window.removeEventListener('mousemove', onMove))

  return { x, y }
}
```

```vue
<!-- MousePosition.vue -->
<script setup lang="ts">
import { useMouse } from '@/composables/use-mouse'

const { x, y } = useMouse()
</script>

<template>
  <p class="font-mono text-sm">x: {{ x }}, y: {{ y }}</p>
</template>
```

**Use renderless components** when the slot structure itself is the API surface and
the parent controls rendering of every row/item.
