# Component Fallthrough Attributes

**Trigger:** wrapper or base components that forward attributes and events to an inner element.

## Contents

- [Key rules](#key-rules)
- [Correct key access](#correct-key-access)
- [useAttrs() is not reactive — use onUpdated](#useattrs-is-not-reactive--use-onupdated)
- [Forwarding listeners after internal logic](#forwarding-listeners-after-internal-logic)
- [Safe checks for optional attrs](#safe-checks-for-optional-attrs)

---

## Key rules

- Hyphenated attribute names require bracket notation (`attrs['data-testid']`), not dot access.
- Listener keys are camelCase `onX` (`attrs.onClick`, not `attrs['@click']`).
- `useAttrs()` always returns the latest values but is **not reactive** — `watch()` on it never fires.
- Use `onUpdated()` for attr-driven side effects.
- Promote frequently observed attrs to **props** when reactive observation is required.

---

## Correct key access

```vue
<script setup lang="ts">
import { useAttrs } from 'vue'

const attrs = useAttrs()

// Hyphenated — must use bracket notation
const testId = attrs['data-testid'] as string | undefined
const ariaLabel = attrs['aria-label'] as string | undefined

// Listeners — camelCase onX
const onClick = attrs.onClick as ((e: MouseEvent) => void) | undefined
const onMouseEnter = attrs.onMouseEnter as ((e: MouseEvent) => void) | undefined
</script>
```

| Parent template | Access in `attrs` |
|---|---|
| `class="foo"` | `attrs.class` |
| `data-id="1"` | `attrs['data-id']` |
| `aria-label="..."` | `attrs['aria-label']` |
| `@click="fn"` | `attrs.onClick` |
| `@custom-event="fn"` | `attrs.onCustomEvent` |
| `@update:modelValue="fn"` | `attrs['onUpdate:modelValue']` |

---

## useAttrs() is not reactive — use onUpdated

```vue
<!-- BAD: watch on attrs never triggers -->
<script setup lang="ts">
import { watch, useAttrs } from 'vue'

const attrs = useAttrs()
watch(() => attrs.class, () => { /* never runs */ })
</script>
```

```vue
<!-- GOOD: onUpdated fires after each parent re-render -->
<script setup lang="ts">
import { onUpdated, useAttrs } from 'vue'

const attrs = useAttrs()

onUpdated(() => {
  console.log('attrs now:', attrs)
})
</script>
```

When reactive observation is critical, promote the attr to a **prop** instead:

```vue
<script setup lang="ts">
import { watch } from 'vue'

const props = defineProps<{ someAttr?: string }>()

watch(() => props.someAttr, (val) => {
  console.log('changed:', val)
})
</script>
```

---

## Forwarding listeners after internal logic

Opt out of automatic inheritance, handle the event internally, then forward.

```vue
<script setup lang="ts">
import { useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()

const handleClick = (e: MouseEvent): void => {
  // internal logic first
  console.log('clicked')
  // forward to parent handler if provided
  ;(attrs.onClick as ((e: MouseEvent) => void) | undefined)?.(e)
}
</script>

<template>
  <button
    v-bind="attrs"
    class="rounded bg-gray-100 px-3 py-1"
    @click.stop="handleClick"
  >
    <slot />
  </button>
</template>
```

---

## Safe checks for optional attrs

```vue
<script setup lang="ts">
import { computed, useAttrs } from 'vue'

const attrs = useAttrs()

const hasTestId = computed(() => 'data-testid' in attrs)
const label = computed(() => (attrs['aria-label'] as string | undefined) ?? 'Button')
</script>
```
