# onUpdated Hook — Performance Pitfalls

## Contents

- [What breaks and why](#what-breaks-and-why)
- [Prefer watchers for data-driven side effects](#prefer-watchers-for-data-driven-side-effects)
- [Prefer computed for derived data](#prefer-computed-for-derived-data)
- [Valid use cases for onUpdated](#valid-use-cases-for-onupdated)
- [Guard pattern when onUpdated is unavoidable](#guard-pattern-when-onupdated-is-unavoidable)
- [Decision table](#decision-table)

**Bottleneck:** `onUpdated` / `updated` fires after every reactive state change that
causes a re-render. Expensive work placed here runs on every keystroke, every store
update, every prop change — often triggering another update in an infinite loop.

Measure with Vue DevTools (Performance panel) before touching this hook. Confirm
`onUpdated` is actually firing more than expected.

## What breaks and why

```vue
<!-- BAD patterns — all cause performance or correctness issues -->
<script setup lang="ts">
import { ref, onUpdated } from 'vue'

const items = ref<string[]>([])
const renderCount = ref(0)
const rawData = ref<number[]>([])

onUpdated(() => {
  // 1. API call on every update — fires on every keystroke
  fetch('/api/sync', { method: 'POST', body: JSON.stringify(items.value) })

  // 2. State mutation — causes another re-render → infinite loop
  renderCount.value++ // DO NOT do this

  // 3. Heavy computation — runs on every state change
  const result = heavyComputation(rawData.value) // expensive every update
})
</script>
```

## Prefer watchers for data-driven side effects

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'

const items = ref<string[]>([])

// Watch only the data that matters — not all updates
const syncToServer = useDebounceFn((data: string[]) => {
  fetch('/api/sync', { method: 'POST', body: JSON.stringify(data) })
}, 500)

watch(items, (newItems) => {
  syncToServer(newItems)
}, { deep: true })
</script>
```

## Prefer computed for derived data

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const numbers = ref([1, 2, 3, 4, 5])

// BAD: mutates state inside onUpdated → infinite loop
// onUpdated(() => { sum.value = numbers.value.reduce(...) })

// GOOD: computed caches and updates only when numbers changes
const sum = computed(() => numbers.value.reduce((a, b) => a + b, 0))
</script>
```

## Valid use cases for onUpdated

Reserve `onUpdated` for post-DOM-update synchronization that cannot be driven by
watchers — typically third-party library integration or scroll position maintenance:

```vue
<script setup lang="ts">
import { ref, onUpdated } from 'vue'

const scrollContainer = ref<HTMLElement | null>(null)
let lastScrollHeight = 0

onUpdated(() => {
  // Maintain scroll position after new messages append
  if (!scrollContainer.value) return
  const { scrollHeight } = scrollContainer.value
  if (scrollHeight !== lastScrollHeight) {
    scrollContainer.value.scrollTop = scrollHeight
    lastScrollHeight = scrollHeight
  }
})
</script>
```

If you find yourself adding a conditional guard to check whether the update is
relevant — that's a signal you should be using a `watch` instead.

## Guard pattern when onUpdated is unavoidable

```vue
<script setup lang="ts">
import { ref, onUpdated } from 'vue'

const content = ref('')
let lastSyncedContent = ''

onUpdated(() => {
  // Act only when the specific value we care about actually changed
  if (content.value === lastSyncedContent) return
  lastSyncedContent = content.value
  scheduleSyncContent(content.value)
})

const scheduleSyncContent = (() => {
  let timer: ReturnType<typeof setTimeout>
  return (value: string) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      fetch('/api/save', { method: 'POST', body: JSON.stringify({ value }) })
    }, 300)
  }
})()
</script>
```

## Decision table

| I want to… | Use |
|---|---|
| React to a specific ref/prop changing | `watch` |
| Derive a value from reactive state | `computed` |
| Sync a third-party library after any DOM update | `onUpdated` (with guard) |
| Call an API when data changes | `watch` + debounce |
| Update another reactive value after a change | `computed` or `watch` |
| Track render count (debug) | `onUpdated` read-only, never write |
