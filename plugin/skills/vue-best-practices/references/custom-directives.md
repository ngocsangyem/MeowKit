# Custom Directives

## Contents
- [Decision table](#decision-table)
- [Basic: function shorthand](#basic-function-shorthand-single-hook)
- [Cleanup: unmounted](#cleanup-always-remove-side-effects-in-unmounted)
- [TypeScript typing](#typescript-type-with-directiveel-value)
- [SSR: getSSRProps](#ssr-provide-getssrprops-to-avoid-hydration-mismatches)
- [Keep directives off components](#keep-directives-off-components)
- [Security note](#security-note)

**Use only when:** you need direct DOM access that cannot be expressed with a component or composable — e.g., `focus`, `resize observer`, `intersection observer`, `click-outside`. Prefer components/composables for stateful or structure-affecting behavior.

## Decision table

| Need | Prefer |
|---|---|
| Focus an input on mount | Directive (`v-focus`) |
| Observe element resize | Directive with cleanup |
| Conditional render wrapper | Component |
| Shared stateful behavior | Composable |

## Basic: function shorthand (single hook)

Use when only `mounted`/`updated` behavior is needed:

```vue
<script setup lang="ts">
const vFocus = (el: HTMLElement) => el.focus()
</script>

<template>
  <input v-focus class="border rounded px-2 py-1" />
</template>
```

## Cleanup: always remove side effects in `unmounted`

```ts
// directives/v-resize.ts
import type { Directive } from 'vue'

type ResizeCallback = (entry: ResizeObserverEntry) => void

export const vResize: Directive<HTMLElement & { _ro?: ResizeObserver }, ResizeCallback> = {
  mounted(el, binding) {
    const observer = new ResizeObserver(([entry]) => binding.value(entry))
    observer.observe(el)
    el._ro = observer
  },
  unmounted(el) {
    el._ro?.disconnect()
    delete el._ro
  },
}
```

```vue
<script setup lang="ts">
import { vResize } from '@/directives/v-resize'

const onResize = (entry: ResizeObserverEntry) => {
  console.log('width:', entry.contentRect.width)
}
</script>

<template>
  <div v-resize="onResize" class="w-full h-32 bg-slate-100 rounded" />
</template>
```

## TypeScript: type with `Directive<El, Value>`

```ts
// directives/v-highlight.ts
import type { Directive } from 'vue'

type HighlightColor = string

export const vHighlight = {
  mounted(el: HTMLElement, binding: { value: HighlightColor }) {
    el.style.backgroundColor = binding.value
  },
  updated(el: HTMLElement, binding: { value: HighlightColor }) {
    el.style.backgroundColor = binding.value
  },
} satisfies Directive<HTMLElement, HighlightColor>

// Augment template types so IDE recognizes v-highlight in SFCs
// declaration merging requires `interface` here — `type` cannot be merged into a module
declare module 'vue' {
  interface ComponentCustomProperties {
    vHighlight: typeof vHighlight
  }
}
```

## SSR: provide `getSSRProps` to avoid hydration mismatches

Directive hooks (`mounted`, `updated`) don't run server-side. If your directive sets attributes that affect the rendered HTML, add `getSSRProps`:

```ts
import type { Directive } from 'vue'

export const vTooltip: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.setAttribute('data-tooltip', binding.value)
    el.classList.add('has-tooltip')
  },
  getSSRProps(binding) {
    // Runs during SSR to produce matching HTML attributes
    return { 'data-tooltip': binding.value, class: 'has-tooltip' }
  },
}
```

## Keep directives off components

Directives bind to a component's root DOM node. If the root changes, the directive silently breaks.

```vue
<!-- WRONG: directive on a component -->
<MyInput v-focus />

<!-- CORRECT: directive inside the component's own template -->
<!-- MyInput.vue -->
<script setup lang="ts">
const vFocus = (el: HTMLElement) => el.focus()
</script>
<template>
  <input v-focus class="border rounded px-2 py-1" />
</template>
```

## Security note

Never write raw user content into `innerHTML` or equivalent DOM properties inside a directive without sanitizing first. Use a library like `DOMPurify` if HTML rendering is required.
