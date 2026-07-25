# Render Functions

**Use only when:** the template syntax cannot express what you need — e.g., fully dynamic tag names, programmatic slot generation, or component libraries where JSX ergonomics outweigh template optimizations. Default to templates; they get static hoisting and patch-flag optimizations that render functions skip.

> Examples below use `export default { setup() }` rather than `<script setup>`: a render function returns the `h()` tree directly, bypassing the template compiler, so it cannot live inside `<script setup>` (which compiles a `<template>`). This is the one sanctioned exception to the `<script setup>`-only house rule.

## Contents
- [Keys for list rendering](#keys-for-list-rendering)
- [Event modifiers](#event-modifiers)
- [v-model binding](#v-model-binding)
- [Custom directives](#custom-directives)
- [Functional components](#functional-components)
- [Dynamic tag names (the real use case)](#dynamic-tag-names-the-real-use-case)

## Keys for list rendering

Without keys, Vue cannot track list items correctly. Always add `key` per node in `h()` lists.

```ts
import { h, ref } from 'vue'

type Item = { id: number; name: string }

export default {
  setup() {
    const items = ref<Item[]>([{ id: 1, name: 'Apple' }])

    return () =>
      h('ul', items.value.map((item) =>
        h('li', { key: item.id }, item.name)
      ))
  },
}
```

## Event modifiers

Use `withModifiers` and `withKeys` instead of calling `e.stopPropagation()` by hand:

```ts
import { h, withModifiers, withKeys } from 'vue'

const handleClick = () => console.log('clicked')
const handleEnter = () => console.log('enter pressed')

export default {
  setup() {
    return () =>
      h('div', [
        h('button', {
          onClick: withModifiers(handleClick, ['stop', 'prevent']),
        }, 'Submit'),
        h('input', {
          onKeyup: withKeys(handleEnter, ['enter']),
        }),
      ])
  },
}
```

## v-model binding

`v-model` compiles to `modelValue` + `onUpdate:modelValue`. Wire it manually in render functions:

```ts
import { h, ref } from 'vue'
import CustomInput from './custom-input.vue'

export default {
  setup() {
    const text = ref('')

    return () =>
      h(CustomInput, {
        modelValue: text.value,
        'onUpdate:modelValue': (val: string) => { text.value = val },
      })
  },
}
```

## Custom directives

Use `withDirectives` — setting `'v-focus': true` as a prop does not work:

```ts
import { h, withDirectives } from 'vue'

const vFocus = { mounted: (el: HTMLElement) => el.focus() }

export default {
  setup() {
    return () => withDirectives(h('input', { class: 'border rounded px-2' }), [[vFocus]])
  },
}
```

## Functional components

For stateless presentational output, a plain function is lighter than a full component object. Vue treats it as a functional component automatically.

```ts
import { h } from 'vue'
import type { FunctionalComponent } from 'vue'

type BadgeProps = { variant?: 'primary' | 'secondary' }

const Badge: FunctionalComponent<BadgeProps> = (props, { slots }) =>
  h(
    'span',
    { class: `badge badge--${props.variant ?? 'primary'}` },
    slots.default?.()
  )

Badge.props = ['variant']

export default Badge
```

## Dynamic tag names (the real use case)

The scenario templates can't express cleanly — tag determined at runtime:

```ts
import { h, resolveComponent } from 'vue'
import type { DefineComponent } from 'vue'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

const HeadingFactory = (level: HeadingLevel) =>
  ({
    props: ['text'],
    setup(props: { text: string }) {
      return () => h(`h${level}`, props.text)
    },
  }) as DefineComponent

export const H1 = HeadingFactory(1)
export const H2 = HeadingFactory(2)
```
