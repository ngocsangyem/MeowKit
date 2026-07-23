# script setup Macros

The compiler macros available inside `<script setup>`. This file is the **macro map** plus the
macros not deeply documented elsewhere. Per-macro deep usage is owned by other references — see the
index below and route there rather than duplicating.

## Contents

- [Macro mechanics](#macro-mechanics)
- [Macro index](#macro-index)
- [defineOptions](#defineoptions)
- [withDefaults](#withdefaults)
- [Generic components](#generic-components)

## Macro mechanics

- **Compile-time, not runtime** — macros are transformed by the compiler; do **not** import them.
- **Top level only** — call them directly in `<script setup>`, not inside functions, conditionals,
  or loops. They cannot be assigned to a renamed binding before use.
- **Statically analyzable** — type arguments (`defineProps<T>()`) must be resolvable at compile time;
  the compiler can resolve imported types since 3.3.

## Macro index

| Macro                                  | Deep coverage                                              |
| -------------------------------------- | --------------------------------------------------------- |
| `defineProps` / `defineEmits`          | `components.md` (typed props/emits, destructure defaults) |
| `defineModel`                          | `components.md` (options, modifiers, multiple models)     |
| `defineSlots`                          | `components.md` (typed slots)                             |
| `defineExpose`                         | `mk:vue-best-practices` › `component-data-flow-advanced.md` |
| `defineOptions`                        | this file                                                 |
| `withDefaults`                         | this file                                                 |
| `generic` (component type params)      | this file                                                 |

## defineOptions

`defineOptions()` (3.3) declares component options that have no dedicated macro — most commonly
`name` (devtools display, recursive self-reference, `<KeepAlive :include>` matching) and
`inheritAttrs`. It cannot declare `props`, `emits`, `slots`, or `expose` — use those macros instead.

```vue
<script setup lang="ts">
defineOptions({ name: 'UserCard' })
</script>
```

> Use-case specifics are owned elsewhere: `inheritAttrs: false` for attribute fallthrough →
> `mk:vue-best-practices` › `component-fallthrough-attrs.md`; `name` for `<KeepAlive>` include/exclude
> matching → `mk:vue-best-practices` › `component-keep-alive.md`. This section documents only the
> macro itself.

## withDefaults

Reactive props destructure (`const { count = 0 } = defineProps<T>()`) is the preferred way to set
defaults — see `components.md`. Reach for `withDefaults()` when you keep the **whole props object**
(`const props = defineProps`) instead of destructuring, e.g. forwarding `props` onward. It is also
the explicit place for **factory defaults** on object/array props.

```vue
<script setup lang="ts">
type Props = {
  label?: string
  tags?: string[]
}

// keeps the full `props` object; factory default avoids a shared array across instances
const props = withDefaults(defineProps<Props>(), {
  label: 'Untitled',
  tags: () => [],
})
</script>
```

## Generic components

Add `generic` to the tag to give a component type parameters — the canonical way to build a
type-safe reusable component (typed list, typed select) whose item type flows from props to slots.

```vue
<script setup lang="ts" generic="T">
defineProps<{
  items: T[]
  selected?: T
}>()

const emit = defineEmits<{ select: [item: T] }>()
</script>

<template>
  <ul class="divide-y">
    <li
      v-for="(item, i) in items"
      :key="i"
      class="cursor-pointer px-3 py-2 hover:bg-gray-50"
      @click="emit('select', item)"
    >
      <slot :item="item" />
    </li>
  </ul>
</template>
```

Constrain the parameter, or declare several, with standard TS syntax:

```vue
<script setup lang="ts" generic="T extends { id: string | number }, K extends keyof T">
defineProps<{ rows: T[]; rowKey: K }>()
</script>
```

`<MyList :items="users" />` then infers `T` from `users`, typing the `select` payload and the
`item` slot prop end-to-end.
