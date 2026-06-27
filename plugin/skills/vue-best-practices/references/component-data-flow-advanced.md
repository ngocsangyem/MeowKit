Basics live in `mk:vue` references/components.md — this covers the deltas.

## Contents

- [provide / inject with InjectionKey](#provide--inject-with-injectionkey)
- [Imperative refs via defineExpose + useTemplateRef](#imperative-refs-via-defineexpose--usetemplateref)
- [Event re-emit — no native bubbling](#event-re-emit--no-native-bubbling)

---

## provide / inject with InjectionKey

Use typed symbol keys so mismatched injections fail at compile time. Keep state
readonly in the provider; expose explicit actions instead of letting consumers mutate freely.

```ts
// keys.ts — shared across provider and consumers
import type { InjectionKey, Readonly, Ref } from 'vue'

type ThemeState = {
  isDark: boolean
}

type ThemeActions = {
  toggle: () => void
  setDark: (value: boolean) => void
}

export const themeStateKey: InjectionKey<Readonly<ThemeState>> = Symbol('theme-state')
export const themeActionsKey: InjectionKey<ThemeActions> = Symbol('theme-actions')
```

```vue
<!-- ThemeProvider.vue -->
<script setup lang="ts">
import { reactive, readonly, provide } from 'vue'
import { themeStateKey, themeActionsKey } from '@/keys'

const state = reactive<{ isDark: boolean }>({ isDark: false })

const toggle = () => { state.isDark = !state.isDark }
const setDark = (value: boolean) => { state.isDark = value }

// readonly prevents consumers from mutating state directly
provide(themeStateKey, readonly(state))
provide(themeActionsKey, { toggle, setDark })
</script>

<template>
  <slot />
</template>
```

```vue
<!-- ThemeToggle.vue — consumer -->
<script setup lang="ts">
import { inject } from 'vue'
import { themeStateKey, themeActionsKey } from '@/keys'

const theme = inject(themeStateKey)
const { toggle } = inject(themeActionsKey)!
</script>

<template>
  <button
    class="rounded px-3 py-1 text-sm"
    :class="theme?.isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'"
    @click="toggle"
  >
    {{ theme?.isDark ? 'Light mode' : 'Dark mode' }}
  </button>
</template>
```

---

## Imperative refs via defineExpose + useTemplateRef

Default: use props/emits. Reach for imperative refs only when a parent must trigger a child action directly (dialog open, form focus, canvas draw).

**Child — expose only the intended API surface:**

```vue
<!-- FocusableInput.vue -->
<script setup lang="ts">
import { useTemplateRef } from 'vue'

const inputEl = useTemplateRef<HTMLInputElement>('input')

const focus = () => inputEl.value?.focus()
const clear = () => {
  if (inputEl.value) inputEl.value.value = ''
}

// expose only what the parent needs — nothing else is accessible
defineExpose({ focus, clear })
</script>

<template>
  <input ref="input" class="rounded border border-gray-300 px-3 py-1.5" />
</template>
```

**Parent — type-safe access via useTemplateRef:**

```vue
<!-- SearchBar.vue -->
<script setup lang="ts">
import { useTemplateRef, onMounted } from 'vue'
import FocusableInput from './FocusableInput.vue'

// useTemplateRef infers the exposed API from the component type (Vue 3.5+)
const inputRef = useTemplateRef<InstanceType<typeof FocusableInput>>('focusable')

onMounted(() => {
  inputRef.value?.focus()
})

const reset = () => inputRef.value?.clear()
</script>

<template>
  <div class="flex gap-2">
    <FocusableInput ref="focusable" />
    <button class="rounded bg-gray-200 px-3 py-1 text-sm" @click="reset">Clear</button>
  </div>
</template>
```

---

## Event re-emit — no native bubbling

Vue component events do not bubble through the component tree the way DOM events do. If
a grandparent needs to react to an event from a grandchild, the intermediate component
must re-emit it explicitly.

```vue
<!-- Grandchild.vue -->
<script setup lang="ts">
type Emits = { saved: [id: string] }
const emit = defineEmits<Emits>()

const save = () => emit('saved', 'record-123')
</script>

<template>
  <button class="rounded bg-blue-600 px-4 py-2 text-white" @click="save">Save</button>
</template>
```

```vue
<!-- Child.vue — must re-emit; the event does not bubble on its own -->
<script setup lang="ts">
import Grandchild from './Grandchild.vue'

type Emits = { saved: [id: string] }
const emit = defineEmits<Emits>()

const onGrandchildSaved = (id: string) => emit('saved', id)
</script>

<template>
  <div class="p-4">
    <Grandchild @saved="onGrandchildSaved" />
  </div>
</template>
```

```vue
<!-- Parent.vue — listens on Child -->
<script setup lang="ts">
import Child from './Child.vue'

const onSaved = (id: string) => {
  console.log('Saved record:', id)
}
</script>

<template>
  <Child @saved="onSaved" />
</template>
```
