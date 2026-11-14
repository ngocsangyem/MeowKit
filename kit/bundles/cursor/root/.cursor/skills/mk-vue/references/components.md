# Components

## Contents

- [Rules](#rules)
- [Component Template](#component-template)
- [Props](#props)
- [Emits](#emits)
- [Slots](#slots)
- [defineModel](#definemodel)
- [Naming](#naming)

## Rules

- Name files `PascalCase` (`UserProfile.vue`) OR `kebab-case` (`user-profile.vue`); always use
  `PascalCase` for component names in source code.
- Compose names from most general to most specific: `SearchButtonClear.vue`, not `ClearSearchButton.vue`.
- Define props with `defineProps<{ propOne: number }>()` and TypeScript types, WITHOUT
  `const props =` — add `const props =` ONLY when props are read in the script block.
- Destructure props to declare default values.
- Define emits with `const emit = defineEmits<{ eventName: [argOne: type]; otherEvent: [] }>()`.
- Use `camelCase` in JS for props and emits, `kebab-case` in templates.
- Use the prop shorthand when the value name matches the prop: `<MyComponent :count />`.
- Use the slot shorthand `<template #default>`, not `<template v-slot:default>`.
- Use explicit `<template>` tags for ALL used slots.
- Use `defineModel<T>({ required, get, set, default })` for `v-model` bindings — avoids defining a
  `modelValue` prop and `update:modelValue` event manually.

## Component Template

A clean baseline. Note named methods, arrow callbacks, typed props/emits/slots.

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

type Props = {
  title: string
  count?: number
}

type Emits = {
  update: [value: number]
}

// Destructure to declare defaults; no `const props =` unless props are read in script.
const { title, count = 0 } = defineProps<Props>()
const emit = defineEmits<Emits>()

const localCount = ref(count)
const doubled = computed(() => localCount.value * 2)

// Arrow function for a method.
const increment = (): void => {
  localCount.value++
  emit('update', localCount.value)
}

onMounted(() => {
  // setup logic
})
</script>

<template>
  <div>
    <h2>{{ title }}</h2>
    <p>Count: {{ localCount }} (doubled: {{ doubled }})</p>
    <button @click="increment">+1</button>
  </div>
</template>
```

## Props

```vue
<script setup lang="ts">
type Props = {
  label: string
  disabled?: boolean
}

// Defaults via destructuring. Reference `label`/`disabled` directly in script and template.
const { label, disabled = false } = defineProps<Props>()
</script>
```

Use `const props = defineProps<Props>()` only when you need the whole `props` object (e.g. passing
it through). Otherwise destructure.

## Emits

```vue
<script setup lang="ts">
type Emits = {
  // event name → tuple of payload types
  submit: [value: string]
  cancel: []
}
const emit = defineEmits<Emits>()

const onSave = (value: string): void => {
  emit('submit', value)
}
</script>
```

In templates, listen with `kebab-case`: `<MyForm @submit="..." @cancel="..." />`.

## Slots

```vue
<template>
  <Card>
    <template #header>
      <h3>Title</h3>
    </template>

    <template #default>
      <p>Body content</p>
    </template>
  </Card>
</template>
```

Type slots when authoring a component:

```vue
<script setup lang="ts">
defineSlots<{
  default: []
  header: []
}>()
</script>
```

## defineModel

Single two-way binding:

```vue
<script setup lang="ts">
const title = defineModel<string>()
</script>
```

With options, modifiers, and a transform:

```vue
<script setup lang="ts">
const [title, modifiers] = defineModel<string>({
  default: 'default value',
  required: true,
  get: (value) => value.trim(), // transform value before binding
  set: (value) => {
    if (modifiers.capitalize) {
      return value.charAt(0).toUpperCase() + value.slice(1)
    }
    return value
  },
})
</script>
```

Multiple named models — `defineModel()` defaults to a `modelValue` prop, so give explicit names
for more than one binding:

```vue
<script setup lang="ts">
const firstName = defineModel<string>('firstName')
const age = defineModel<number>('age')
</script>
```

Used in the parent template:

```html
<UserForm v-model:first-name="user.firstName" v-model:age="user.age" />
```

Native `v-model` has built-in modifiers (`.lazy`, `.number`, `.trim`); component models can
implement equivalents via the `[value, modifiers]` form shown above. For the full modifier-handling
contract, read <https://vuejs.org/guide/components/v-model.html#handling-v-model-modifiers>.

## Naming

- Components: `PascalCase` source names, general → specific.
- Files: `PascalCase.vue` or `kebab-case.vue` (be consistent within a project).
- Composables: `use` prefix, `camelCase` symbol, `kebab-case` file — see `composables.md`.
